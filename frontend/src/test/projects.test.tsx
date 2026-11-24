import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { AuthProvider } from '../auth/AuthContext';
import { defaultTokenStorage } from '../auth/TokenStorage';
import { routes } from '../app/routes';
import type { ProjectSummary } from '../api/services/AuthService';

function renderApp(initialPath = '/projects') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('[US-3] Frontend - Create a project acceptance tests', () => {
  const mockUser = { id: 'u-owner-1', email: 'owner@local.test' };

  const existingProject: ProjectSummary = {
    id: 'p-orig-1',
    key: 'WEBS',
    name: 'Website redesign',
    description: 'Corporate website upgrade',
    role: 'OWNER',
    boards: [{ id: 'b-orig-1', name: 'Board' }],
    projectMembers: [{ userName: 'owner@local.test', role: 'OWNER' }],
  };

  const newProject: ProjectSummary = {
    id: 'p-new-1',
    key: 'PROD',
    name: 'Product launch',
    description: null,
    role: 'OWNER',
    boards: [{ id: 'b-new-1', name: 'Board' }],
    projectMembers: [{ userName: 'owner@local.test', role: 'OWNER' }],
  };

  beforeEach(() => {
    cleanup();
    defaultTokenStorage.setToken('valid-auth-token-123');
    vi.restoreAllMocks();

    vi.spyOn(api.auth, 'me').mockResolvedValue(mockUser);
  });

  it('State 02: displays empty state with "Create project" action button when user has no projects', async () => {
    vi.spyOn(api.auth, 'getProjects').mockResolvedValueOnce([]);

    renderApp('/projects');

    expect(
      await screen.findByText('No projects yet. Create your first project to get started.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('create-project-btn')).toHaveTextContent('Create project');
  });

  it('State 01: displays existing projects with "Open project" button and "Create project" button', async () => {
    vi.spyOn(api.auth, 'getProjects').mockResolvedValueOnce([existingProject]);

    renderApp('/projects');

    expect(await screen.findByText('Website redesign')).toBeInTheDocument();
    expect(screen.getByText('Owner · Private project')).toBeInTheDocument();
    expect(screen.getByTestId('open-project-btn-p-orig-1')).toHaveTextContent('Open project');
    expect(screen.getByTestId('create-project-btn')).toHaveTextContent('Create project');
  });

  it('State 03: opens dialog form with focused input, helper text, and Cancel path', async () => {
    vi.spyOn(api.auth, 'getProjects').mockResolvedValueOnce([existingProject]);

    renderApp('/projects');

    const openCreateBtn = await screen.findByTestId('create-project-btn');
    fireEvent.click(openCreateBtn);

    const dialog = await screen.findByTestId('create-project-dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /create a project/i })).toBeInTheDocument();
    expect(screen.getByText('Give your team a shared workspace.')).toBeInTheDocument();

    const input = screen.getByLabelText(/project name \*/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(screen.getByText('Required field. You will become this project’s Owner.')).toBeInTheDocument();

    // Cancel closes dialog
    const cancelBtn = screen.getByTestId('create-project-cancel-btn');
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId('create-project-dialog')).not.toBeInTheDocument();
  });

  it('State 04: rejects empty or whitespace names with validation error "Enter a project name."', async () => {
    vi.spyOn(api.auth, 'getProjects').mockResolvedValueOnce([existingProject]);
    const createSpy = vi.spyOn(api.project, 'createProject');

    renderApp('/projects');

    fireEvent.click(await screen.findByTestId('create-project-btn'));

    const submitBtn = await screen.findByTestId('create-project-submit-btn');
    fireEvent.click(submitBtn);

    expect(await screen.findByTestId('create-project-field-error')).toHaveTextContent(
      'Enter a project name.'
    );
    expect(screen.getByLabelText(/project name \*/i)).toHaveAttribute('aria-invalid', 'true');
    expect(createSpy).not.toHaveBeenCalled();

    // Whitespace only
    const input = screen.getByLabelText(/project name \*/i);
    fireEvent.change(input, { target: { value: '    ' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByTestId('create-project-field-error')).toHaveTextContent(
      'Enter a project name.'
    );
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('State 05 & 06: creates project, shows saving progress, closes dialog, and displays success banner and new project', async () => {
    let projectList = [existingProject];
    vi.spyOn(api.auth, 'getProjects').mockImplementation(async () => projectList);

    let resolveCreate: (val: ProjectSummary) => void = () => {};
    const createSpy = vi.spyOn(api.project, 'createProject').mockImplementation(
      () =>
        new Promise<ProjectSummary>((resolve) => {
          resolveCreate = (proj) => {
            projectList = [proj, ...projectList];
            resolve(proj);
          };
        })
    );

    renderApp('/projects');

    fireEvent.click(await screen.findByTestId('create-project-btn'));

    const input = await screen.findByLabelText(/project name \*/i);
    fireEvent.change(input, { target: { value: 'Product launch' } });

    const submitBtn = screen.getByTestId('create-project-submit-btn');
    fireEvent.click(submitBtn);

    // State 05: pending state
    expect(screen.getByTestId('create-project-submit-btn')).toHaveTextContent('Creating…');
    expect(screen.getByTestId('create-project-submit-btn')).toBeDisabled();
    expect(screen.getByTestId('create-project-cancel-btn')).toBeDisabled();
    expect(input).toBeDisabled();

    // Prevent duplicate submission
    fireEvent.click(submitBtn);
    expect(createSpy).toHaveBeenCalledTimes(1);

    // Resolve creation
    resolveCreate(newProject);

    // State 06: Created and listed
    const banner = await screen.findByTestId('project-created-banner');
    expect(banner).toHaveTextContent('✓ Project created. You are the Owner.');

    expect(screen.queryByTestId('create-project-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Product launch')).toBeInTheDocument();
    expect(screen.getByTestId('open-project-btn-p-new-1')).toBeInTheDocument();
  });

  it('State 07: retains typed name and displays error banner on creation failure', async () => {
    vi.spyOn(api.auth, 'getProjects').mockResolvedValueOnce([existingProject]);
    vi.spyOn(api.project, 'createProject').mockRejectedValueOnce(new Error('Network error'));

    renderApp('/projects');

    fireEvent.click(await screen.findByTestId('create-project-btn'));

    const input = await screen.findByLabelText(/project name \*/i);
    fireEvent.change(input, { target: { value: 'Retry Project' } });

    const submitBtn = screen.getByTestId('create-project-submit-btn');
    fireEvent.click(submitBtn);

    const errorBanner = await screen.findByTestId('create-project-server-error');
    expect(errorBanner).toHaveTextContent(
      'Couldn’t create the project. Your name is kept. Try again.'
    );
    expect(input).toHaveValue('Retry Project');
    expect(submitBtn).toBeEnabled();
    expect(screen.getByTestId('create-project-dialog')).toBeInTheDocument();
  });

  it('persists newly created project after reload', async () => {
    let projectList = [existingProject];
    vi.spyOn(api.auth, 'getProjects').mockImplementation(async () => projectList);
    vi.spyOn(api.project, 'createProject').mockImplementation(async (input) => {
      const created: ProjectSummary = {
        id: 'p-new-persisted',
        key: 'PERS',
        name: input.name,
        role: 'OWNER',
        boards: [{ id: 'b-new-persisted', name: 'Board' }],
      };
      projectList = [created, ...projectList];
      return created;
    });

    const { unmount } = renderApp('/projects');

    fireEvent.click(await screen.findByTestId('create-project-btn'));

    const input = await screen.findByLabelText(/project name \*/i);
    fireEvent.change(input, { target: { value: 'Persisted Project' } });
    fireEvent.click(screen.getByTestId('create-project-submit-btn'));

    await screen.findByTestId('project-created-banner');
    expect(screen.getByText('Persisted Project')).toBeInTheDocument();

    unmount();

    // Reload / Re-render page
    const reloaded = renderApp('/projects');
    expect(await reloaded.findByText('Persisted Project')).toBeInTheDocument();
    expect(reloaded.getByTestId('open-project-btn-p-new-persisted')).toBeInTheDocument();
  });
});
