import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';
import { AuthProvider } from '../auth/AuthContext';
import { defaultTokenStorage } from '../auth/TokenStorage';
import { routes } from '../app/routes';
import { ColumnCategory, type BoardDetails, type TaskItem } from '../domain/models';

function renderApp(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('[US-5] Frontend - Restrict project data to members (T1WOR-143)', () => {
  const mockUser = { id: 'u-user-1', email: 'member@test.com' };
  const boardId = '01a1aad8-c24a-73f9-a095-069769796312';

  const permittedBoard: BoardDetails = {
    id: boardId,
    projectId: 'p-secret-1',
    projectName: 'Confidential Finance Project',
    name: 'Sprint board',
    columns: [
      { id: 'c-1', name: 'To do', category: ColumnCategory.ToDo, position: '1' },
      { id: 'c-2', name: 'In progress', category: ColumnCategory.InProgress, position: '2' },
      { id: 'c-3', name: 'Done', category: ColumnCategory.Done, position: '3' },
    ],
  };

  const permittedTasks: TaskItem[] = [
    {
      id: 't-1',
      readableId: 'SEC-1',
      number: 1,
      boardId,
      title: 'Audited Financial Statement',
      description: 'Private records',
      status: ColumnCategory.ToDo,
      columnId: 'c-1',
      columnName: 'To do',
      position: '0|hzzzzz:',
      priority: 'HIGH',
      assignees: [],
      assigneeIds: [],
    },
  ];

  beforeEach(() => {
    cleanup();
    defaultTokenStorage.setToken('valid-member-token');
    vi.restoreAllMocks();

    vi.spyOn(api.auth, 'me').mockResolvedValue(mockUser);
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([
      {
        id: 'p-secret-1',
        key: 'SEC',
        name: 'Permitted Project',
        description: 'Permitted',
        role: 'WRITER',
        boards: [{ id: boardId, name: 'Sprint board' }],
      },
    ]);
  });

  it('State 01: displays neutral loading shell without revealing target private title or tasks while checking access', async () => {
    // Keep access check pending
    vi.spyOn(api.board, 'getBoardWithTasks').mockReturnValue(new Promise(() => {}));

    renderApp(`/boards/${boardId}`);

    // Wait for auth to resolve and verify neutral shell according to Figma specs
    const statusShell = await screen.findByTestId('project-access-checking');
    expect(statusShell).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Checking access' })).toBeInTheDocument();
    expect(screen.getByText('Please wait…')).toBeInTheDocument();
    expect(screen.getByText('Loading your permitted workspace…')).toBeInTheDocument();
    expect(
      screen.getByText('Private boards and tasks remain hidden until access is confirmed.')
    ).toBeInTheDocument();

    // Verify private data is NOT leaked
    expect(screen.queryByText('Confidential Finance Project')).not.toBeInTheDocument();
    expect(screen.queryByText('Audited Financial Statement')).not.toBeInTheDocument();
  });

  it('State 02: authorized member opening project can see permitted board and tasks', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue({
      board: permittedBoard,
      tasks: permittedTasks,
    });

    renderApp(`/boards/${boardId}`);

    // Verify board and permitted tasks are displayed
    expect(await screen.findByText('Sprint board')).toBeInTheDocument();
    expect(screen.getByText('Audited Financial Statement')).toBeInTheDocument();
    expect(screen.getByText('SEC-1')).toBeInTheDocument();
  });

  it('State 03: direct link from non-member denies access and shows generic "Project unavailable" without disclosing private details', async () => {
    // Server returns 404 or generic non-member response
    vi.spyOn(api.board, 'getBoardWithTasks').mockRejectedValue(
      new ApiError(`Board '${boardId}' was not found.`, 404, null)
    );

    renderApp(`/boards/${boardId}`);

    // Verify State 03 generic message
    expect(await screen.findByRole('heading', { level: 1, name: 'Project unavailable' })).toBeInTheDocument();
    expect(
      screen.getByText('You don’t have access, or this project is unavailable.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Return to your projects. If you need access, contact a project Owner.')
    ).toBeInTheDocument();

    // Verify private details are NOT exposed
    expect(screen.queryByText('Confidential Finance Project')).not.toBeInTheDocument();
    expect(screen.queryByText('Audited Financial Statement')).not.toBeInTheDocument();

    // Clicking "Back to projects" navigates to /projects (State 07)
    const backBtn = screen.getByRole('button', { name: 'Back to projects' });
    fireEvent.click(backBtn);

    expect(await screen.findByText('Your projects')).toBeInTheDocument();
  });

  it('State 04: when access is revoked during use, clears sensitive cached data and shows "Your project access has changed"', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue({
      board: permittedBoard,
      tasks: permittedTasks,
    });

    // Revocation simulated when user attempts to move/update task and receives 403
    vi.spyOn(api.board, 'moveTask').mockRejectedValue(
      new ApiError('You do not have access to this project.', 403, [
        { message: 'Forbidden', extensions: { code: 'AUTH_NOT_AUTHORIZED' } },
      ])
    );

    renderApp(`/boards/${boardId}`);

    expect(await screen.findByText('Audited Financial Statement')).toBeInTheDocument();

    // Drag / move the task to trigger mutation
    const inProgressColumn = screen.getByRole('region', { name: /In progress/i });
    const taskCard = screen.getByText('Audited Financial Statement');

    const dataTransfer = {
      data: { 'application/x-task-id': 't-1' } as Record<string, string>,
      setData(k: string, v: string) {
        this.data[k] = v;
      },
      getData(k: string) {
        return this.data[k];
      },
      dropEffect: 'move',
    };

    // Simulate drag & drop triggering handleMoveTask
    fireEvent.dragStart(taskCard, { dataTransfer });
    fireEvent.dragOver(inProgressColumn, { dataTransfer });
    fireEvent.drop(inProgressColumn, { dataTransfer });

    // Verify transition to State 04
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your project access has changed' })
    ).toBeInTheDocument();
    expect(screen.getByText('You no longer have access to this project.')).toBeInTheDocument();
    expect(
      screen.getByText('Return to your projects. If you need access, contact a project Owner.')
    ).toBeInTheDocument();

    // Sensitive cached data must be purged from DOM
    expect(screen.queryByText('Audited Financial Statement')).not.toBeInTheDocument();
    expect(screen.queryByText('Sprint board')).not.toBeInTheDocument();

    // Primary button Back to projects
    const backBtn = screen.getByRole('button', { name: 'Back to projects' });
    fireEvent.click(backBtn);

    expect(await screen.findByText('Your projects')).toBeInTheDocument();
  });

  it('State 05: displays "Your session has expired" when request fails with 401 and offers "Log in"', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockRejectedValue(
      new ApiError('Session expired', 401, [
        { message: 'Unauthenticated', extensions: { code: 'AUTH_NOT_AUTHENTICATED' } },
      ])
    );

    renderApp(`/boards/${boardId}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Your session has expired' })).toBeInTheDocument();
    expect(screen.getByText('Log in again to continue.')).toBeInTheDocument();
    expect(
      screen.getByText('Private project content is hidden until your session and membership are verified.')
    ).toBeInTheDocument();

    const loginBtn = screen.getByRole('button', { name: 'Log in' });
    fireEvent.click(loginBtn);

    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });

  it('State 06: displays "Couldn’t connect" on network error with "Try again" and "Back to projects"', async () => {
    const boardSpy = vi
      .spyOn(api.board, 'getBoardWithTasks')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        board: permittedBoard,
        tasks: permittedTasks,
      });

    renderApp(`/boards/${boardId}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Couldn’t connect' })).toBeInTheDocument();
    expect(screen.getByText('We couldn’t check project access.')).toBeInTheDocument();
    expect(screen.getByText('Check your connection and try again.')).toBeInTheDocument();

    // Click "Try again" to recover
    const retryBtn = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(retryBtn);

    // Content resolves after successful retry
    expect(await screen.findByText('Sprint board')).toBeInTheDocument();
    expect(screen.getByText('Audited Financial Statement')).toBeInTheDocument();
    expect(boardSpy).toHaveBeenCalledTimes(2);
  });

  it('State 07: safe navigation back to /projects displays refreshed permitted projects list', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockRejectedValue(
      new ApiError('Forbidden', 403, null)
    );

    renderApp(`/boards/${boardId}`);

    const backBtn = await screen.findByRole('button', { name: 'Back to projects' });
    fireEvent.click(backBtn);

    expect(await screen.findByText('Your projects')).toBeInTheDocument();
    expect(screen.getByText('Permitted Project')).toBeInTheDocument();
    expect(screen.queryByText('Confidential Finance Project')).not.toBeInTheDocument();
  });
});
