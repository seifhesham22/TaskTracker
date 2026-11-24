import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { api } from '../api';
import { AuthProvider } from '../auth/AuthContext';
import { defaultTokenStorage } from '../auth/TokenStorage';
import { ProjectRole } from '../domain/models';
import { routes } from '../app/routes';

describe('[US-4] Frontend - Manage project members acceptance tests', () => {
  const currentUserId = 'u-dombele';
  const mockUser = { id: currentUserId, email: 'dombele@example.com' };

  const mockProjectDetailsOwner = {
    id: 'proj-123',
    key: 'WEB',
    name: 'Website redesign',
    description: 'Main web overhaul',
    role: 'OWNER',
    boards: [{ id: 'b-1', name: 'Sprint 1' }],
    projectMembers: [
      {
        projectId: 'proj-123',
        userId: currentUserId,
        userName: 'Dombele',
        role: ProjectRole.Owner,
        joinedAt: '2026-11-20T10:00:00Z',
      },
      {
        projectId: 'proj-123',
        userId: 'u-seif',
        userName: 'Seif',
        role: ProjectRole.Writer,
        joinedAt: '2026-11-21T10:00:00Z',
      },
    ],
  };

  const mockProjectDetailsWriter = {
    ...mockProjectDetailsOwner,
    role: 'WRITER',
  };

  const mockProjectDetailsReader = {
    ...mockProjectDetailsOwner,
    role: 'READER',
  };

  beforeEach(() => {
    cleanup();
    defaultTokenStorage.setToken('valid-test-token');
    vi.restoreAllMocks();
    vi.spyOn(api.auth, 'me').mockResolvedValue(mockUser);
  });

  function renderAt(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    return render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    );
  }

  it('State 01: renders Owner membership list with member roles, (you) badge, and last Owner marker', async () => {
    vi.spyOn(api.projectMember, 'getProjectDetails').mockResolvedValue(mockProjectDetailsOwner);

    renderAt('/projects/proj-123/members');

    expect(await screen.findByRole('heading', { level: 1, name: /project members/i })).toBeInTheDocument();
    expect(screen.getByText(/Website redesign · Owner view/i)).toBeInTheDocument();

    // Dombele (you)
    expect(screen.getByText(/Dombele \(you\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Owner · Last Owner/i)).toBeInTheDocument();

    // Seif
    expect(screen.getByText('Seif')).toBeInTheDocument();
    expect(screen.getByText('Writer')).toBeInTheDocument();

    // Last owner does NOT have a remove button
    expect(screen.queryByTestId(`remove-member-btn-${currentUserId}`)).toBeNull();

    // Removable member has Remove button
    expect(screen.getByTestId('remove-member-btn-u-seif')).toBeInTheDocument();

    // Add member action is available for Owner
    expect(screen.getByTestId('add-member-open-btn')).toBeInTheDocument();
  });

  it('State 15 & 16: renders Writer and Reader views with restricted notice and no add/remove buttons', async () => {
    vi.spyOn(api.projectMember, 'getProjectDetails').mockResolvedValue(mockProjectDetailsWriter);

    renderAt('/projects/proj-123/members');

    expect(await screen.findByText(/Website redesign · Writer view/i)).toBeInTheDocument();
    expect(screen.getByText(/Only an Owner can add or remove members./i)).toBeInTheDocument();
    expect(screen.queryByTestId('add-member-open-btn')).toBeNull();
    expect(screen.queryByTestId('remove-member-btn-u-seif')).toBeNull();

    // Verify Reader view as well
    cleanup();
    vi.spyOn(api.projectMember, 'getProjectDetails').mockResolvedValue(mockProjectDetailsReader);
    renderAt('/projects/proj-123/members');
    expect(await screen.findByText(/Website redesign · Reader view/i)).toBeInTheDocument();
    expect(screen.getByText(/Only an Owner can add or remove members./i)).toBeInTheDocument();
  });

  it('State 02 -> 07 -> 08: adds new member, updates list, and displays success banner', async () => {
    vi.spyOn(api.projectMember, 'getProjectDetails').mockResolvedValue(mockProjectDetailsOwner);
    const mockAdd = vi.spyOn(api.projectMember, 'addProjectMember').mockResolvedValue({
      projectId: 'proj-123',
      userId: 'u-mina',
      userName: 'Mina',
      role: ProjectRole.Writer,
      joinedAt: '2026-11-24T12:00:00Z',
    });

    renderAt('/projects/proj-123/members');

    expect(await screen.findByTestId('add-member-open-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('add-member-open-btn'));

    // Modal opens (State 02)
    expect(screen.getByRole('dialog', { name: /add a member/i })).toBeInTheDocument();

    const emailInput = screen.getByTestId('add-member-email-input');
    fireEvent.change(emailInput, { target: { value: 'mina@example.com' } });

    const submitBtn = screen.getByTestId('add-member-submit-btn');
    fireEvent.click(submitBtn);

    expect(mockAdd).toHaveBeenCalledWith({
      projectId: 'proj-123',
      email: 'mina@example.com',
      role: ProjectRole.Writer,
    });

    // State 08: Member added banner and updated list
    expect(
      await screen.findByText('✓ Mina added as a Writer.')
    ).toBeInTheDocument();

    expect(screen.getByTestId('project-member-item-u-mina')).toBeInTheDocument();
  });

  it('State 06: prevents adding duplicate project member with clear validation message', async () => {
    vi.spyOn(api.projectMember, 'getProjectDetails').mockResolvedValue(mockProjectDetailsOwner);

    renderAt('/projects/proj-123/members');

    expect(await screen.findByTestId('add-member-open-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('add-member-open-btn'));

    const emailInput = screen.getByTestId('add-member-email-input');
    fireEvent.change(emailInput, { target: { value: 'Seif' } });

    const submitBtn = screen.getByTestId('add-member-submit-btn');
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Seif is already a project member. Choose another account.')
    ).toBeInTheDocument();
  });

  it('State 10 -> 11 -> 12: removes member after confirmation and displays access revoked banner', async () => {
    vi.spyOn(api.projectMember, 'getProjectDetails').mockResolvedValue(mockProjectDetailsOwner);
    const mockRemove = vi.spyOn(api.projectMember, 'removeProjectMember').mockResolvedValue({
      projectId: 'proj-123',
      userId: 'u-seif',
      userName: 'Seif',
      role: ProjectRole.Writer,
      joinedAt: '2026-11-21T10:00:00Z',
    });

    renderAt('/projects/proj-123/members');

    expect(await screen.findByTestId('remove-member-btn-u-seif')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('remove-member-btn-u-seif'));

    // Confirmation dialog opens (State 10)
    expect(screen.getByRole('dialog', { name: /remove seif\?/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Seif will lose access to this project’s boards and tasks. This does not delete their account or existing work./i
      )
    ).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('remove-member-confirm-btn');
    fireEvent.click(confirmBtn);

    expect(mockRemove).toHaveBeenCalledWith('proj-123', 'u-seif');

    // State 12: Member removed banner
    expect(
      await screen.findByText('✓ Seif removed. Project access revoked.')
    ).toBeInTheDocument();

    expect(screen.queryByTestId('project-member-item-u-seif')).toBeNull();
    // Dombele still remains
    expect(screen.getByTestId(`project-member-item-${currentUserId}`)).toBeInTheDocument();
  });

  it('allows canceling member removal without any changes', async () => {
    vi.spyOn(api.projectMember, 'getProjectDetails').mockResolvedValue(mockProjectDetailsOwner);
    const mockRemove = vi.spyOn(api.projectMember, 'removeProjectMember');

    renderAt('/projects/proj-123/members');

    expect(await screen.findByTestId('remove-member-btn-u-seif')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('remove-member-btn-u-seif'));

    const cancelBtn = screen.getByTestId('remove-member-cancel-btn');
    fireEvent.click(cancelBtn);

    expect(mockRemove).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('project-member-item-u-seif')).toBeInTheDocument();
  });
});
