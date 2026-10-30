import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';
import { routes } from '../app/routes';
import { ColumnCategory, TaskPriority } from '../domain/models';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('Board & Task acceptance tests', () => {
  const mockBoardData = {
    board: {
      id: '01a18766-48b5-7fb8-a04c-13e1bf648def',
      projectId: 'p-1',
      projectName: 'Test Project',
      name: 'Test Board',
      columns: [
        { id: 'c-backlog', name: 'Backlog', category: ColumnCategory.Backlog, position: 'V' },
        { id: 'c-todo', name: 'To do', category: ColumnCategory.ToDo, position: 'l' },
        { id: 'c-progress', name: 'In progress', category: ColumnCategory.InProgress, position: 't' },
        { id: 'c-done', name: 'Done', category: ColumnCategory.Done, position: 'x' },
      ],
      members: [
        { userId: 'u-1', userName: 'admin@local.test', email: 'admin@local.test' },
        { userId: 'u-2', userName: 'user1@local.test', email: 'user1@local.test' },
      ],
    },
    tasks: [],
  };

  it('renders all four status columns even when the board has no tasks', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardData);

    renderAt('/tasks');

    expect(await screen.findByRole('heading', { level: 1, name: /test board/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /backlog/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /to do/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /in progress/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /done/i })).toBeInTheDocument();
  });

  it('renders task cards with title only without empty gaps or null text', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue({
      ...mockBoardData,
      tasks: [
        {
          id: 't-1',
          readableId: 'TES-1',
          number: 1,
          boardId: mockBoardData.board.id,
          title: 'Title only task',
          description: null,
          status: ColumnCategory.Backlog,
          columnId: 'c-backlog',
          columnName: 'Backlog',
          priority: null,
          assigneeIds: [],
          dueDate: null,
          createdAt: '2026-10-30T00:00:00Z',
        },
      ],
    });

    renderAt('/tasks');

    const titleEl = await screen.findByText('Title only task');
    expect(titleEl).toBeInTheDocument();

    const card = screen.getByTestId('task-card-t-1');
    expect(card.textContent).not.toContain('null');
    expect(card.textContent).not.toContain('undefined');
  });

  it('renders task card with assignee, priority and due date', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue({
      ...mockBoardData,
      tasks: [
        {
          id: 't-2',
          readableId: 'TES-2',
          number: 2,
          boardId: mockBoardData.board.id,
          title: 'Full feature task',
          description: 'Detailed description',
          status: ColumnCategory.InProgress,
          columnId: 'c-progress',
          columnName: 'In progress',
          priority: TaskPriority.High,
          assigneeIds: ['u-1'],
          dueDate: '2026-11-15T00:00:00Z',
          createdAt: '2026-10-30T00:00:00Z',
        },
      ],
    });

    renderAt('/tasks');

    expect(await screen.findByText('Full feature task')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText(/admin@local.test/i)).toBeInTheDocument();
    expect(screen.getByText(/Nov 15, 2026/i)).toBeInTheDocument();
  });

  it('shows "Board not found" message when board ID is unknown', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockRejectedValue(
      new ApiError("Board '00000000-0000-0000-0000-000000000099' was not found.", 404, null)
    );

    renderAt('/tasks?boardId=00000000-0000-0000-0000-000000000099');

    expect(await screen.findByTestId('board-not-found')).toBeInTheDocument();
    expect(screen.getByText(/board not found/i)).toBeInTheDocument();
  });

  it('shows error state when backend is unreachable instead of blank page', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockRejectedValue(
      new Error('Failed to fetch')
    );

    renderAt('/tasks');

    expect(await screen.findByTestId('board-error')).toBeInTheDocument();
    expect(screen.getByText(/failed to load board/i)).toBeInTheDocument();
  });

  it('validates required title in create task form', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardData);

    renderAt('/tasks');

    const openBtn = await screen.findByTestId('create-task-btn');
    fireEvent.click(openBtn);

    const submitBtn = screen.getByRole('button', { name: /^create task$/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
  });

  it('submits createTask mutation and adds task without page reload', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardData);
    const createSpy = vi.spyOn(api.board, 'createTask').mockResolvedValue({
      id: 't-new',
      readableId: 'TES-10',
      number: 10,
      boardId: mockBoardData.board.id,
      title: 'Created via Form',
      description: null,
      status: ColumnCategory.Backlog,
      columnId: 'c-backlog',
      columnName: 'Backlog',
      priority: null,
      assigneeIds: [],
      dueDate: null,
      createdAt: '2026-10-30T00:00:00Z',
    });

    renderAt('/tasks');

    const openBtn = await screen.findByTestId('create-task-btn');
    fireEvent.click(openBtn);

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Created via Form' } });

    const submitBtn = screen.getByRole('button', { name: /^create task$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Created via Form',
          boardId: mockBoardData.board.id,
        })
      );
    });

    expect(await screen.findByText('Created via Form')).toBeInTheDocument();
  });

  it('shows server error and keeps typed values when server rejects task', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardData);
    vi.spyOn(api.board, 'createTask').mockRejectedValue(
      new ApiError('User is not a member of project TES', 400, null)
    );

    renderAt('/tasks');

    const openBtn = await screen.findByTestId('create-task-btn');
    fireEvent.click(openBtn);

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Rejected task' } });

    const submitBtn = screen.getByRole('button', { name: /^create task$/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('User is not a member of project TES')).toBeInTheDocument();
    expect(titleInput).toHaveValue('Rejected task');
  });
});
