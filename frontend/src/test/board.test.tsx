import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';
import { routes } from '../app/routes';
import { ColumnCategory, type TaskItem, TaskPriority } from '../domain/models';

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

  it('displays columns from the board query in position order, including renamed columns', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue({
      board: {
        id: '01a18766-48b5-7fb8-a04c-13e1bf648def',
        projectId: 'p-1',
        projectName: 'Test Project',
        name: 'Renamed Columns Board',
        columns: [
          { id: 'c-1', name: 'Custom Backlog', category: ColumnCategory.Backlog, position: '01' },
          { id: 'c-2', name: 'Ready For Dev', category: ColumnCategory.ToDo, position: '02' },
          { id: 'c-3', name: 'Building & Testing', category: ColumnCategory.InProgress, position: '03' },
          { id: 'c-4', name: 'Shipped', category: ColumnCategory.Done, position: '04' },
        ],
        members: [],
      },
      tasks: [],
    });

    renderAt('/tasks');

    expect(await screen.findByRole('heading', { level: 2, name: /custom backlog/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /ready for dev/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /building & testing/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /shipped/i })).toBeInTheDocument();

    const columnHeadings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(columnHeadings).toEqual(['Custom Backlog', 'Ready For Dev', 'Building & Testing', 'Shipped']);
  });

  it('places tasks strictly into the column matching columnId even if status matches another column', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue({
      board: {
        id: '01a18766-48b5-7fb8-a04c-13e1bf648def',
        projectId: 'p-1',
        projectName: 'Test Project',
        name: 'Test Board',
        columns: [
          { id: 'col-a', name: 'Backlog A', category: ColumnCategory.Backlog, position: 'A' },
          { id: 'col-b', name: 'Backlog B', category: ColumnCategory.Backlog, position: 'B' },
        ],
        members: [],
      },
      tasks: [
        {
          id: 'task-in-b',
          readableId: 'TES-99',
          number: 99,
          boardId: '01a18766-48b5-7fb8-a04c-13e1bf648def',
          title: 'Task in second column',
          description: null,
          status: ColumnCategory.Backlog,
          columnId: 'col-b',
          columnName: 'Backlog B',
          priority: null,
          assigneeIds: [],
          dueDate: null,
          createdAt: '2026-10-30T00:00:00Z',
        },
      ],
    });

    renderAt('/tasks');

    expect(await screen.findByText('Task in second column')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-task-in-b')).toBeInTheDocument();
  });

  it('moves a card to another column via drag and drop without a page reload', async () => {
    const initialBoardData = {
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
    };
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(initialBoardData);
    const moveSpy = vi.spyOn(api.board, 'moveTask').mockResolvedValue({
      id: 't-1',
      readableId: 'TES-1',
      number: 1,
      boardId: mockBoardData.board.id,
      title: 'Title only task',
      description: null,
      status: ColumnCategory.InProgress,
      columnId: 'c-progress',
      columnName: 'In progress',
      priority: null,
      assigneeIds: [],
      dueDate: null,
      createdAt: '2026-10-30T00:00:00Z',
    });

    renderAt('/tasks');

    const card = await screen.findByTestId('task-card-t-1');
    const inProgressColumn = screen.getByTestId('board-column-IN_PROGRESS');

    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(key: string, val: string) {
        this.data[key] = val;
      },
      getData(key: string) {
        return this.data[key] || '';
      },
      effectAllowed: 'none',
      dropEffect: 'none',
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(inProgressColumn, { dataTransfer });
    fireEvent.drop(inProgressColumn, { dataTransfer });

    await waitFor(() => {
      expect(moveSpy).toHaveBeenCalledWith({
        taskId: 't-1',
        columnId: 'c-progress',
      });
    });

    // Verify task is now inside In progress column
    expect(inProgressColumn).toContainElement(screen.getByTestId('task-card-t-1'));
  });

  it('shows saving indicator on the card while move is in progress', async () => {
    const initialBoardData = {
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
    };
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(initialBoardData);
    let resolveMove: (task: TaskItem) => void = () => {};
    const movePromise = new Promise<TaskItem>((resolve) => {
      resolveMove = resolve;
    });
    vi.spyOn(api.board, 'moveTask').mockReturnValue(movePromise);

    renderAt('/tasks');

    const card = await screen.findByTestId('task-card-t-1');
    const todoColumn = screen.getByTestId('board-column-TO_DO');

    const dataTransfer = {
      data: { 'application/x-task-id': 't-1' },
      setData: vi.fn(),
      getData: (key: string) => (key === 'application/x-task-id' ? 't-1' : ''),
      effectAllowed: 'none',
      dropEffect: 'none',
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(todoColumn, { dataTransfer });

    // While saving, card shows that it is saving
    expect(await screen.findByText('Saving...')).toBeInTheDocument();

    // Resolve move
    resolveMove({
      id: 't-1',
      readableId: 'TES-1',
      number: 1,
      boardId: mockBoardData.board.id,
      title: 'Title only task',
      description: null,
      status: ColumnCategory.ToDo,
      columnId: 'c-todo',
      columnName: 'To do',
      priority: null,
      assigneeIds: [],
      dueDate: null,
      createdAt: '2026-10-30T00:00:00Z',
    });

    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    });
    expect(todoColumn).toContainElement(screen.getByTestId('task-card-t-1'));
  });

  it('reverts card to original column and displays server message when move is refused', async () => {
    const initialBoardData = {
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
    };
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(initialBoardData);
    vi.spyOn(api.board, 'moveTask').mockRejectedValue(
      new ApiError('Failed to move task: network error', 500, null)
    );

    renderAt('/tasks');

    const card = await screen.findByTestId('task-card-t-1');
    const backlogColumn = screen.getByTestId('board-column-BACKLOG');
    const doneColumn = screen.getByTestId('board-column-DONE');

    const dataTransfer = {
      data: { 'application/x-task-id': 't-1' },
      setData: vi.fn(),
      getData: (key: string) => (key === 'application/x-task-id' ? 't-1' : ''),
      effectAllowed: 'none',
      dropEffect: 'none',
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(doneColumn, { dataTransfer });

    // Expect server error message to appear
    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to move task: network error/i);

    // Card reverts to original column (backlog)
    expect(backlogColumn).toContainElement(screen.getByTestId('task-card-t-1'));
    expect(doneColumn).not.toContainElement(screen.getByTestId('task-card-t-1'));
  });

  it('loads seeded test board with UUIDv7 ID without showing "Board not found"', async () => {
    const seededBoardId = '01a1aad8-c24a-73f9-a095-069769796312';
    const seededBoardData = {
      board: {
        id: seededBoardId,
        projectId: '01a1aad8-c24a-73cd-b1e8-23e9150a4fa7',
        name: 'Test Board',
        columns: [
          { id: 'c-b1', name: 'Backlog', category: ColumnCategory.Backlog, position: 'A' },
          { id: 'c-b2', name: 'Done', category: ColumnCategory.Done, position: 'B' },
        ],
      },
      tasks: [
        {
          id: '01a1aae6-ea53-72e0-a09a-e48651aea223',
          readableId: 'TES-1',
          number: 1,
          boardId: seededBoardId,
          title: 'Design the onboarding checklist for new projects',
          status: ColumnCategory.Done,
          columnId: 'c-b2',
          columnName: 'Done',
          priority: null,
          assigneeIds: [],
          dueDate: null,
          createdAt: '2026-11-05T08:34:54Z',
        },
      ],
    };

    const getSpy = vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(seededBoardData);

    renderAt(`/tasks?boardId=${seededBoardId}`);

    expect(await screen.findByRole('heading', { level: 1, name: /test board/i })).toBeInTheDocument();
    expect(screen.queryByTestId('board-not-found')).not.toBeInTheDocument();
    expect(screen.getByText('Design the onboarding checklist for new projects')).toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledWith(seededBoardId);
  });

  it('keeps created task visible after reload and maintains strict isolation across boards', async () => {
    const boardAId = '01a1aad8-c24a-73f9-a095-069769796312';
    const boardBId = '11111111-2222-4333-8444-555555555555';

    const boardAData = {
      board: {
        id: boardAId,
        projectId: 'p-1',
        name: 'First Board',
        columns: [{ id: 'col-a1', name: 'Backlog', category: ColumnCategory.Backlog, position: 'A' }],
      },
      tasks: [
        {
          id: 'task-a1',
          readableId: 'TES-1',
          number: 1,
          boardId: boardAId,
          title: 'Existing Board A task',
          status: ColumnCategory.Backlog,
          columnId: 'col-a1',
          columnName: 'Backlog',
          priority: null,
          assigneeIds: [],
          dueDate: null,
          createdAt: '2026-11-05T08:00:00Z',
        },
      ],
    };

    const boardBTasks: TaskItem[] = [];
    const boardBData = {
      board: {
        id: boardBId,
        projectId: 'p-1',
        name: 'Second Board',
        columns: [{ id: 'col-b1', name: 'Backlog', category: ColumnCategory.Backlog, position: 'A' }],
      },
      get tasks() {
        return boardBTasks;
      },
    };

    vi.spyOn(api.board, 'getBoardWithTasks').mockImplementation(async (id: string) => {
      if (id === boardAId) return { board: boardAData.board, tasks: [...boardAData.tasks] };
      if (id === boardBId) return { board: boardBData.board, tasks: [...boardBData.tasks] };
      throw new ApiError(`Board '${id}' was not found.`, 404, null);
    });

    vi.spyOn(api.board, 'createTask').mockImplementation(async (input) => {
      const created: TaskItem = {
        id: 'new-b-task-id',
        readableId: 'TES-2',
        number: 2,
        boardId: input.boardId,
        title: input.title,
        status: ColumnCategory.Backlog,
        columnId: 'col-b1',
        columnName: 'Backlog',
        priority: null,
        assigneeIds: [],
        dueDate: null,
        createdAt: '2026-11-05T09:00:00Z',
      };
      boardBTasks.push(created);
      return created;
    });

    // 1. Visit Second Board
    const { unmount } = renderAt(`/tasks?boardId=${boardBId}`);

    expect(await screen.findByRole('heading', { level: 1, name: /second board/i })).toBeInTheDocument();
    expect(screen.queryByText('Task created on Second Board')).not.toBeInTheDocument();

    // 2. Create task on Second Board
    const openBtn = screen.getByTestId('create-task-btn');
    fireEvent.click(openBtn);

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Task created on Second Board' } });

    const submitBtn = screen.getByRole('button', { name: /^create task$/i });
    fireEvent.click(submitBtn);

    // Task appears immediately without page reload
    expect(await screen.findByText('Task created on Second Board')).toBeInTheDocument();

    unmount();

    // 3. Simulate page refresh / reload on Second Board: task must remain visible!
    const reloadRender = renderAt(`/tasks?boardId=${boardBId}`);
    expect(await reloadRender.findByRole('heading', { level: 1, name: /second board/i })).toBeInTheDocument();
    expect(reloadRender.getByText('Task created on Second Board')).toBeInTheDocument();

    reloadRender.unmount();

    // 4. Visit First Board: Second Board's task must NOT appear here
    const boardARender = renderAt(`/tasks?boardId=${boardAId}`);
    expect(await boardARender.findByRole('heading', { level: 1, name: /first board/i })).toBeInTheDocument();
    expect(boardARender.getByText('Existing Board A task')).toBeInTheDocument();
    expect(boardARender.queryByText('Task created on Second Board')).not.toBeInTheDocument();
  });
});
