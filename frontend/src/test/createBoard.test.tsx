import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api, ApiError } from '../api';
import { AuthProvider } from '../auth/AuthContext';
import { defaultTokenStorage } from '../auth/TokenStorage';
import { routes } from '../app/routes';
import { ColumnCategory } from '../domain/models';
import type { ProjectSummary } from '../api/services/AuthService';

describe('[US-7] Frontend - Create a board inside a project (T1WOR-148)', () => {
  const mockUser = {
    id: 'user-owner-1',
    userName: 'owner@test.com',
    email: 'owner@test.com',
  };

  const mockProjectOwner: ProjectSummary = {
    id: 'proj-1',
    key: 'WEB',
    name: 'Website redesign',
    description: null,
    role: 'OWNER',
    boards: [
      { id: 'b-sprint-2', name: 'Sprint 2' },
    ],
    projectMembers: [{ userName: 'owner@test.com', role: 'OWNER' }],
  };

  const mockProjectWriter: ProjectSummary = {
    ...mockProjectOwner,
    role: 'WRITER',
    projectMembers: [{ userName: 'owner@test.com', role: 'WRITER' }],
  };

  const mockProjectReader: ProjectSummary = {
    ...mockProjectOwner,
    role: 'READER',
    projectMembers: [{ userName: 'owner@test.com', role: 'READER' }],
  };

  beforeEach(() => {
    cleanup();
    defaultTokenStorage.setToken('valid-owner-token');
    vi.restoreAllMocks();
    vi.spyOn(api.auth, 'me').mockResolvedValue(mockUser);
  });

  const renderApp = (initialPath = '/projects/proj-1/boards') => {
    const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
    return render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    );
  };

  it('State 01: renders Owner board-list entry with Create board button and existing boards', async () => {
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectOwner]);

    renderApp('/projects/proj-1/boards');

    expect(await screen.findByRole('heading', { level: 2, name: 'Project boards' })).toBeInTheDocument();
    expect(screen.getByTestId('project-boards-subtitle')).toHaveTextContent('Website redesign · Owner');
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
    expect(screen.getByText('Board · Website redesign')).toBeInTheDocument();
    expect(screen.getByTestId('open-board-btn-b-sprint-2')).toBeInTheDocument();

    const createBtn = screen.getByTestId('start-create-board-btn');
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveTextContent('Create board');
  });

  it('State 02 & State 03: opens creation form and rejects empty / whitespace board name', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectOwner]);

    renderApp('/projects/proj-1/boards');

    const createBtn = await screen.findByTestId('start-create-board-btn');
    await user.click(createBtn);

    expect(await screen.findByRole('heading', { level: 2, name: 'Create a board' })).toBeInTheDocument();
    expect(screen.getByText('Website redesign')).toBeInTheDocument();
    expect(screen.getByText('This board will belong to Website redesign.')).toBeInTheDocument();

    const submitBtn = screen.getByTestId('create-board-submit-btn');
    await user.click(submitBtn);

    const nameInput = screen.getByTestId('board-name-input');
    expect(nameInput).toHaveClass('create-board-input--error');
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByTestId('board-name-error')).toHaveTextContent('Enter a board name.');

    await user.type(nameInput, '     ');
    await user.click(submitBtn);
    expect(screen.getByTestId('board-name-error')).toHaveTextContent('Enter a board name.');
  });

  it('State 04: duplicate name in project is rejected with server error message', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectOwner]);
    vi.spyOn(api.board, 'createBoard').mockRejectedValue(
      new ApiError("A board named 'Sprint 2' already exists in this project.", 400, null)
    );

    renderApp('/projects/proj-1/boards');

    await user.click(await screen.findByTestId('start-create-board-btn'));

    const nameInput = await screen.findByTestId('board-name-input');
    await user.type(nameInput, 'Sprint 2');

    await user.click(screen.getByTestId('create-board-submit-btn'));

    expect(await screen.findByTestId('board-name-error')).toHaveTextContent(
      'A board with this name already exists in this project.'
    );
    expect(nameInput).toHaveClass('create-board-input--error');
    expect(nameInput).toHaveValue('Sprint 2');
  });

  it('State 05 & State 06: shows pending feedback and opens newly created empty board with success banner', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectOwner]);

    let resolveCreation: (val: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveCreation = resolve;
    });
    vi.spyOn(api.board, 'createBoard').mockReturnValue(pendingPromise as unknown as Promise<never>);

    renderApp('/projects/proj-1/boards');

    await user.click(await screen.findByTestId('start-create-board-btn'));

    const nameInput = await screen.findByTestId('board-name-input');
    await user.type(nameInput, 'Sprint 3');

    const submitBtn = screen.getByTestId('create-board-submit-btn');
    await user.click(submitBtn);

    // State 05: pending state
    expect(nameInput).toBeDisabled();
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('Creating…');
    expect(screen.getByTestId('create-board-cancel-btn')).toBeDisabled();

    // Board query setup for State 06
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue({
      board: {
        id: 'b-sprint-3',
        projectId: 'proj-1',
        projectName: 'Website redesign',
        name: 'Sprint 3',
        columns: [
          { id: 'c-todo', name: 'To do', category: ColumnCategory.ToDo, position: 'l' },
          { id: 'c-inprogress', name: 'In progress', category: ColumnCategory.InProgress, position: 't' },
          { id: 'c-done', name: 'Done', category: ColumnCategory.Done, position: 'x' },
        ],
        members: [],
      },
      tasks: [],
    });

    // Resolve creation
    resolveCreation!({
      id: 'b-sprint-3',
      projectId: 'proj-1',
      projectName: 'Website redesign',
      name: 'Sprint 3',
      columns: [
        { id: 'c-todo', name: 'To do', category: ColumnCategory.ToDo, position: 'l' },
        { id: 'c-inprogress', name: 'In progress', category: ColumnCategory.InProgress, position: 't' },
        { id: 'c-done', name: 'Done', category: ColumnCategory.Done, position: 'x' },
      ],
      members: [],
    });

    // State 06: Created empty board layout
    expect(await screen.findByTestId('board-created-banner')).toHaveTextContent(
      '✓ Board created in Website redesign.'
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Sprint 3' })).toBeInTheDocument();
    expect(screen.getAllByText(/Website redesign/).length).toBeGreaterThanOrEqual(1);

    const emptyTextElements = screen.getAllByText('No tasks yet');
    expect(emptyTextElements.length).toBeGreaterThanOrEqual(3);

    expect(screen.getByTestId('back-to-boards-btn')).toHaveAttribute(
      'href',
      '/projects/proj-1/boards'
    );
  });

  it('State 07: generic failure keeps entered name and offers immediate retry', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectOwner]);
    vi.spyOn(api.board, 'createBoard').mockRejectedValue(
      new ApiError('Couldn’t create the board. Your name is kept. Try again.', 500, null)
    );

    renderApp('/projects/proj-1/boards');

    await user.click(await screen.findByTestId('start-create-board-btn'));

    const nameInput = await screen.findByTestId('board-name-input');
    await user.type(nameInput, 'Sprint 3');

    await user.click(screen.getByTestId('create-board-submit-btn'));

    expect(await screen.findByTestId('board-create-error')).toHaveTextContent(
      'Couldn’t create the board. Your name is kept. Try again.'
    );
    expect(nameInput).toHaveValue('Sprint 3');
    expect(screen.getByTestId('create-board-submit-btn')).toBeEnabled();
    expect(screen.getByTestId('create-board-submit-btn')).toHaveTextContent('Create board');
  });

  it('State 08: Writer role does not see Create board control and sees Owner guidance message', async () => {
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectWriter]);

    renderApp('/projects/proj-1/boards');

    expect(await screen.findByTestId('project-boards-subtitle')).toHaveTextContent(
      'Website redesign · Writer'
    );
    expect(screen.queryByTestId('start-create-board-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('create-board-role-note')).toHaveTextContent(
      'Only an Owner can create boards.'
    );
  });

  it('State 09: Reader role does not see Create board control and sees Owner guidance message', async () => {
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectReader]);

    renderApp('/projects/proj-1/boards');

    expect(await screen.findByTestId('project-boards-subtitle')).toHaveTextContent(
      'Website redesign · Reader'
    );
    expect(screen.queryByTestId('start-create-board-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('create-board-role-note')).toHaveTextContent(
      'Only an Owner can create boards.'
    );
  });
});
