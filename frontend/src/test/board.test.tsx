import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('rejects parent task completion when incomplete subtasks exist, identifies children, preserves status, and succeeds once children are done', async () => {
    const parentTaskId = 'parent-task-1';
    const subtask1Id = 'subtask-1';
    const subtask2Id = 'subtask-2';

    let parentTask: TaskItem = {
      id: parentTaskId,
      readableId: 'TES-24',
      number: 24,
      boardId: mockBoardData.board.id,
      title: 'Prepare release v1',
      description: 'Finish all release requirements',
      status: ColumnCategory.InProgress,
      columnId: 'c-progress',
      columnName: 'In progress',
      priority: TaskPriority.High,
      assigneeIds: [],
    };

    let subtask1: TaskItem = {
      id: subtask1Id,
      readableId: 'TES-26',
      number: 26,
      boardId: mockBoardData.board.id,
      title: 'Review launch checklist',
      status: ColumnCategory.InProgress,
      columnId: 'c-progress',
      columnName: 'In progress',
      parentTaskId: parentTaskId,
      assigneeIds: [],
    };

    let subtask2: TaskItem = {
      id: subtask2Id,
      readableId: 'TES-27',
      number: 27,
      boardId: mockBoardData.board.id,
      title: 'Confirm release date',
      status: ColumnCategory.ToDo,
      columnId: 'c-todo',
      columnName: 'To do',
      parentTaskId: parentTaskId,
      assigneeIds: [],
    };

    vi.spyOn(api.board, 'getBoardWithTasks').mockImplementation(async () => ({
      ...mockBoardData,
      tasks: [parentTask, subtask1, subtask2],
    }));

    vi.spyOn(api.board, 'moveTask').mockImplementation(async ({ taskId, columnId }) => {
      if (taskId === parentTaskId && columnId === 'c-done') {
        // If subtasks are not done, reject!
        if (subtask1.status !== ColumnCategory.Done || subtask2.status !== ColumnCategory.Done) {
          const { IncompleteSubtasksApiError } = await import('../api');
          throw new IncompleteSubtasksApiError(
            "TES-24 can't be completed while these 2 subtasks are not done: TES-26 (Review launch checklist), TES-27 (Confirm release date).",
            [
              { id: subtask1Id, readableId: 'TES-26', title: 'Review launch checklist' },
              { id: subtask2Id, readableId: 'TES-27', title: 'Confirm release date' },
            ],
            {}
          );
        }
        parentTask = {
          ...parentTask,
          status: ColumnCategory.Done,
          columnId: 'c-done',
          columnName: 'Done',
        };
        return parentTask;
      }

      if (taskId === subtask1Id && columnId === 'c-done') {
        subtask1 = { ...subtask1, status: ColumnCategory.Done, columnId: 'c-done', columnName: 'Done' };
        return subtask1;
      }

      if (taskId === subtask2Id && columnId === 'c-done') {
        subtask2 = { ...subtask2, status: ColumnCategory.Done, columnId: 'c-done', columnName: 'Done' };
        return subtask2;
      }

      return parentTask;
    });

    renderAt('/tasks');

    // 1. Open parent task containing incomplete subtasks
    const openParentDetailsBtn = await screen.findByTestId(`open-task-${parentTaskId}`);
    fireEvent.click(openParentDetailsBtn);

    // Modal opens
    expect(await screen.findByTestId('parent-task-details-modal')).toBeInTheDocument();
    expect(screen.getByTestId('parent-status-badge')).toHaveTextContent('In progress');
    expect(screen.getByTestId('subtasks-count')).toHaveTextContent('0 / 2 done');

    // 2. Attempt to mark it as completed
    const markCompleteBtn = screen.getByTestId('mark-complete-button');
    fireEvent.click(markCompleteBtn);

    // 3. Verify that an appropriate error message appears
    expect(await screen.findByTestId('parent-completion-blocked-banner')).toBeInTheDocument();
    expect(screen.getByText('Complete 2 subtasks first')).toBeInTheDocument();
    expect(
      screen.getByText('This parent task can’t be completed while its subtasks are still in progress.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('parent-completion-error-message')).toHaveTextContent(
      "TES-24 can't be completed while these 2 subtasks are not done: TES-26 (Review launch checklist), TES-27 (Confirm release date)."
    );

    // 4. Verify that the incomplete children are identified
    expect(screen.getByText('Incomplete subtasks')).toBeInTheDocument();
    expect(screen.getByTestId('subtasks-count')).toHaveTextContent('2 remaining');
    expect(screen.getByTestId(`incomplete-subtask-${subtask1Id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`incomplete-subtask-${subtask2Id}`)).toBeInTheDocument();
    expect(screen.getByText('Open each subtask above to finish the remaining work.')).toBeInTheDocument();

    // 5. Verify that the parent status does not change
    expect(screen.getByTestId('parent-status-badge')).toHaveTextContent('In progress');

    // 6. Complete subtasks via convenient access (Open subtask -> Complete this subtask)
    fireEvent.click(screen.getByTestId(`open-subtask-${subtask1Id}`));
    expect(await screen.findByTestId(`subtask-detail-view-${subtask1Id}`)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('complete-subtask-btn'));

    await waitFor(() => {
      expect(subtask1.status).toBe(ColumnCategory.Done);
    });

    fireEvent.click(screen.getByTestId('back-to-parent-btn'));

    // Complete second subtask
    fireEvent.click(screen.getByTestId(`open-subtask-${subtask2Id}`));
    fireEvent.click(screen.getByTestId('complete-subtask-btn'));

    await waitFor(() => {
      expect(subtask2.status).toBe(ColumnCategory.Done);
    });

    fireEvent.click(screen.getByTestId('back-to-parent-btn'));

    // Ready state: All subtasks are complete
    expect(await screen.findByTestId('all-subtasks-complete-banner')).toBeInTheDocument();
    expect(screen.getByText('All subtasks are complete.')).toBeInTheDocument();
    expect(screen.getByTestId('subtasks-count')).toHaveTextContent('2 / 2 done');

    // 7. Retry the parent completion -> Verify that completion is accepted
    const retryCompleteBtn = screen.getByTestId('mark-complete-button');
    fireEvent.click(retryCompleteBtn);

    expect(await screen.findByTestId('task-completed-banner')).toBeInTheDocument();
    expect(screen.getByText('✓ Task completed')).toBeInTheDocument();
    expect(screen.getByTestId('parent-status-badge')).toHaveTextContent('Done');
    expect(screen.getByTestId('parent-completed-button')).toBeDisabled();
  });

  describe('US-13 Web subtask creation functionality', () => {
    it('creates a subtask under a parent task, renders validation errors, visually distinguishes them, and persists relationship across reloads', async () => {
      const parentTask: TaskItem = {
        id: 'parent-task-1',
        readableId: 'TES-24',
        number: 24,
        boardId: mockBoardData.board.id,
        title: 'Prepare the project launch',
        description: 'Agree on milestones and assign the launch checklist.',
        status: ColumnCategory.InProgress,
        columnId: 'c-progress',
        columnName: 'In progress',
        priority: TaskPriority.High,
        assigneeIds: [],
        createdAt: '2026-11-01T00:00:00Z',
      };

      const existingSubtask: TaskItem = {
        id: 'subtask-1',
        readableId: 'TES-25',
        number: 25,
        boardId: mockBoardData.board.id,
        title: 'Agree on launch milestones',
        status: ColumnCategory.Done,
        columnId: 'c-done',
        columnName: 'Done',
        parentTaskId: 'parent-task-1',
        assigneeIds: [],
        createdAt: '2026-11-01T01:00:00Z',
      };

      const tasksDatabase: TaskItem[] = [parentTask, existingSubtask];

      vi.spyOn(api.board, 'getBoardWithTasks').mockImplementation(async () => ({
        ...mockBoardData,
        tasks: [...tasksDatabase],
      }));

      vi.spyOn(api.board, 'createSubtask').mockImplementation(async (parent, title) => {
        const newSub: TaskItem = {
          id: 'subtask-new-28',
          readableId: 'TES-28',
          number: 28,
          boardId: parent.boardId,
          title: title.trim(),
          status: ColumnCategory.ToDo,
          columnId: 'c-todo',
          columnName: 'To do',
          parentTaskId: parent.id,
          assigneeIds: [],
          createdAt: '2026-11-01T02:00:00Z',
        };
        tasksDatabase.push(newSub);
        return newSub;
      });

      // 1. Render board
      const { unmount } = renderAt('/tasks');

      // Verify visual distinction on the board:
      // Parent task has subtask count badge and no subtask pill
      const parentCard = await screen.findByTestId('task-card-parent-task-1');
      expect(parentCard).toBeInTheDocument();
      expect(screen.getByTestId('subtasks-count-parent-task-1')).toHaveTextContent(/1 subtask/i);
      expect(screen.queryByTestId('subtask-badge-parent-task-1')).not.toBeInTheDocument();

      // Existing subtask has subtask class and distinctive '↳ Subtask' indicator
      const subtaskCard = screen.getByTestId('task-card-subtask-1');
      expect(subtaskCard).toHaveClass('card--subtask');
      expect(screen.getByTestId('subtask-badge-subtask-1')).toHaveTextContent(/↳ Subtask/i);

      // 2. Open the parent task
      const openParentDetailsBtn = screen.getByTestId('open-task-parent-task-1');
      fireEvent.click(openParentDetailsBtn);

      const detailsModal = await screen.findByTestId('parent-task-details-modal');
      expect(detailsModal).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Prepare the project launch' })).toBeInTheDocument();
      expect(screen.getByTestId('subtasks-completion-count')).toHaveTextContent('1 / 1 done');
      expect(screen.getByTestId('subtask-item-subtask-1')).toHaveTextContent('TES-25 · Done');

      // 3. Select Add subtask
      const addSubtaskBtn = screen.getByTestId('add-subtask-button');
      fireEvent.click(addSubtaskBtn);

      const createSubtaskModal = await screen.findByTestId('create-subtask-modal');
      expect(createSubtaskModal).toBeInTheDocument();
      expect(screen.getByText('TES-24 · Prepare the project launch')).toBeInTheDocument();

      // 4. Try submitting an empty title and verify validation
      const submitBtn = screen.getByTestId('submit-create-subtask');
      fireEvent.click(submitBtn);

      const errorMsg = await screen.findByTestId('subtask-title-error');
      expect(errorMsg).toHaveTextContent('Subtask title is required.');

      // 5. Enter a title and save
      const titleInput = screen.getByTestId('subtask-title-input');
      fireEvent.change(titleInput, { target: { value: 'Prepare the release notes' } });
      fireEvent.click(submitBtn);

      // 6. Verify that the subtask creation modal closes and success banner appears on parent details
      await waitFor(() => {
        expect(screen.queryByTestId('create-subtask-modal')).not.toBeInTheDocument();
      });

      const successBanner = await screen.findByTestId('subtask-created-banner');
      expect(successBanner).toHaveTextContent('✓ Subtask created');

      // 7. Verify new subtask appears under the correct parent with updated count
      expect(screen.getByTestId('subtasks-completion-count')).toHaveTextContent('1 / 2 done');
      expect(screen.getByTestId('subtask-item-subtask-new-28')).toHaveTextContent('TES-28 · To do');
      expect(screen.getByTestId('subtask-item-subtask-new-28')).toHaveTextContent('Prepare the release notes');

      unmount();

      // 8. Reload the board / parent task and verify relationship remains correct
      const reloaded = renderAt('/tasks');

      // Board has 2 subtasks now for parent
      const reloadedParentCard = await reloaded.findByTestId('task-card-parent-task-1');
      expect(reloadedParentCard).toBeInTheDocument();
      expect(reloaded.getByTestId('subtasks-count-parent-task-1')).toHaveTextContent(/2 subtasks/i);

      // Newly created subtask card on board is visually distinct
      const newSubCard = reloaded.getByTestId('task-card-subtask-new-28');
      expect(newSubCard).toHaveClass('card--subtask');
      expect(reloaded.getByTestId('subtask-badge-subtask-new-28')).toHaveTextContent(/↳ Subtask/i);

      // Open parent task after reload and verify child tasks are intact
      fireEvent.click(reloaded.getByTestId('open-task-parent-task-1'));
      expect(await reloaded.findByTestId('parent-task-details-modal')).toBeInTheDocument();
      expect(reloaded.getByTestId('subtasks-completion-count')).toHaveTextContent('1 / 2 done');
      expect(reloaded.getByTestId('subtask-item-subtask-1')).toHaveTextContent('TES-25 · Done');
      expect(reloaded.getByTestId('subtask-item-subtask-new-28')).toHaveTextContent('TES-28 · To do');
    });

    it('preserves subtask relationship and subtask logo when subtask status changes', async () => {
      const parentTask: TaskItem = {
        id: 'parent-task-1',
        readableId: 'TES-24',
        number: 24,
        boardId: mockBoardData.board.id,
        title: 'Prepare the project launch',
        status: ColumnCategory.InProgress,
        columnId: 'c-progress',
        columnName: 'In progress',
        priority: TaskPriority.High,
        assigneeIds: [],
        createdAt: '2026-11-01T00:00:00Z',
      };

      let subtask: TaskItem = {
        id: 'subtask-1',
        readableId: 'TES-25',
        number: 25,
        boardId: mockBoardData.board.id,
        title: 'Agree on launch milestones',
        status: ColumnCategory.ToDo,
        columnId: 'c-todo',
        columnName: 'To do',
        parentTaskId: 'parent-task-1',
        assigneeIds: [],
        createdAt: '2026-11-01T01:00:00Z',
      };

      vi.spyOn(api.board, 'getBoardWithTasks').mockImplementation(async () => ({
        ...mockBoardData,
        tasks: [parentTask, subtask],
      }));

      vi.spyOn(api.board, 'moveTask').mockImplementation(async ({ taskId, columnId }) => {
        expect(taskId).toBe('subtask-1');
        const col = mockBoardData.board.columns.find((c) => c.id === columnId)!;
        subtask = {
          ...subtask,
          columnId: col.id,
          columnName: col.name,
          status: col.category,
        };
        return subtask;
      });

      renderAt('/tasks');

      // Subtask initially has subtask badge on the board
      const subtaskCard = await screen.findByTestId('task-card-subtask-1');
      expect(subtaskCard).toHaveClass('card--subtask');
      expect(screen.getByTestId('subtask-badge-subtask-1')).toHaveTextContent(/↳ Subtask/i);

      // Move subtask to In Progress via drag-and-drop
      const progressColumn = screen.getByTestId('board-column-IN_PROGRESS');
      fireEvent.drop(progressColumn, {
        dataTransfer: {
          getData: (format: string) => (format === 'text/plain' ? 'subtask-1' : ''),
        },
      });

      // Verify subtask card STILL has subtask badge and class after moving
      await waitFor(() => {
        expect(screen.getByTestId('subtask-badge-subtask-1')).toHaveTextContent(/↳ Subtask/i);
      });
      expect(screen.getByTestId('task-card-subtask-1')).toHaveClass('card--subtask');

      // Open parent task details: subtask is STILL present under parent with updated status
      fireEvent.click(screen.getByTestId('open-task-parent-task-1'));
      expect(await screen.findByTestId('parent-task-details-modal')).toBeInTheDocument();
      expect(screen.getByTestId('subtask-item-subtask-1')).toHaveTextContent('TES-25 · In progress');
    });
  });

  describe('[US-11] Web task editing functionality', () => {
    const editBoardId = '01a1aad8-c24a-73f9-a095-069769796312';
    const initialTask: TaskItem = {
      id: 'task-orig-1',
      readableId: 'TES-24',
      number: 24,
      boardId: editBoardId,
      title: 'Plan the project launch',
      description: 'Agree on milestones and assign the launch checklist',
      status: ColumnCategory.ToDo,
      columnId: 'col-todo',
      columnName: 'To do',
      priority: TaskPriority.Medium,
      assigneeIds: ['u-1'],
      startDate: '2026-11-16T00:00:00Z',
      dueDate: '2026-11-20T00:00:00Z',
      createdAt: '2026-11-01T00:00:00Z',
    };

    const boardWithTask = {
      board: {
        id: editBoardId,
        projectId: 'p-1',
        projectName: 'Test Project',
        name: 'Project Launch Board',
        columns: [
          { id: 'col-todo', name: 'To do', category: ColumnCategory.ToDo, position: 'A' },
        ],
        members: [{ userId: 'u-1', userName: 'admin@local.test', email: 'admin@local.test' }],
      },
      tasks: [initialTask],
    };

    it('opens an existing task and selects edit, modifies all 5 fields, and saves updates', async () => {
      let currentTaskState = { ...initialTask };

      vi.spyOn(api.board, 'getBoardWithTasks').mockImplementation(async () => ({
        board: boardWithTask.board,
        tasks: [currentTaskState],
      }));

      const updateSpy = vi.spyOn(api.board, 'updateTask').mockImplementation(async (input) => {
        currentTaskState = {
          ...currentTaskState,
          title: input.title ?? currentTaskState.title,
          description: input.description !== undefined ? input.description : currentTaskState.description,
          priority: input.priority !== undefined ? input.priority : currentTaskState.priority,
          startDate: input.startDate !== undefined ? input.startDate : currentTaskState.startDate,
          dueDate: input.dueDate !== undefined ? input.dueDate : currentTaskState.dueDate,
        };
        return currentTaskState;
      });

      renderAt(`/tasks?boardId=${editBoardId}`);

      // 1. Open existing task by clicking on card
      const card = await screen.findByTestId('task-card-task-orig-1');
      expect(card).toBeInTheDocument();
      fireEvent.click(card);

      // 2. Task Details modal opens
      const detailsDialog = await screen.findByTestId('task-details-dialog');
      expect(within(detailsDialog).getByRole('heading', { level: 3, name: /task details/i })).toBeInTheDocument();
      expect(within(detailsDialog).getByText('Plan the project launch')).toBeInTheDocument();

      // 3. Click "Edit task"
      const editBtn = within(detailsDialog).getByTestId('open-edit-task-btn');
      fireEvent.click(editBtn);

      // 4. Form displays existing values
      expect(await screen.findByRole('heading', { level: 3, name: /edit task/i })).toBeInTheDocument();
      const titleInput = screen.getByLabelText(/title \*/i);
      const descInput = screen.getByLabelText(/description/i);
      const prioritySelect = screen.getByLabelText(/priority/i);
      const startInput = screen.getByLabelText(/start date/i);
      const dueInput = screen.getByLabelText(/due date/i);

      expect(titleInput).toHaveValue('Plan the project launch');
      expect(descInput).toHaveValue('Agree on milestones and assign the launch checklist');
      expect(prioritySelect).toHaveValue(TaskPriority.Medium);
      expect(startInput).toHaveValue('2026-11-16');
      expect(dueInput).toHaveValue('2026-11-20');

      // 5. Modify each of the five editable fields
      fireEvent.change(titleInput, { target: { value: 'Prepare the project launch' } });
      fireEvent.change(descInput, { target: { value: 'Agree on milestones and execute the launch checklist' } });
      fireEvent.change(prioritySelect, { target: { value: TaskPriority.High } });
      fireEvent.change(startInput, { target: { value: '2026-11-17' } });
      fireEvent.change(dueInput, { target: { value: '2026-11-22' } });

      // 6. Save changes
      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            taskId: 'task-orig-1',
            title: 'Prepare the project launch',
            priority: TaskPriority.High,
          })
        );
      });

      // 7. Verify Task Details reflects updated values and shows "✓ Task updated" banner
      const updatedDetailsDialog = await screen.findByTestId('task-details-dialog');
      expect(await screen.findByTestId('task-updated-banner')).toHaveTextContent('✓ Task updated');
      expect(within(updatedDetailsDialog).getByText('Prepare the project launch')).toBeInTheDocument();
      expect(within(updatedDetailsDialog).getByText(/Priority: High/i)).toBeInTheDocument();
      expect(within(updatedDetailsDialog).getByText(/Start date: Nov 17, 2026/i)).toBeInTheDocument();
      expect(within(updatedDetailsDialog).getByText(/Due date: Nov 22, 2026/i)).toBeInTheDocument();

      // Close task details
      const closeBtn = within(updatedDetailsDialog).getByRole('button', { name: /close/i });
      fireEvent.click(closeBtn);

      // 8. Verify board also reflects updated title and priority badge
      expect(await within(card).findByText('Prepare the project launch')).toBeInTheDocument();
      expect(within(card).getByText('HIGH')).toBeInTheDocument();
    });

    it('rejects invalid inputs with validation messages and cancels unsaved changes', async () => {
      vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue({
        board: boardWithTask.board,
        tasks: [initialTask],
      });

      renderAt(`/tasks?boardId=${editBoardId}`);

      const editBtn = await screen.findByTestId('edit-task-button-task-orig-1');
      fireEvent.click(editBtn);

      const titleInput = await screen.findByLabelText(/title \*/i);
      const dueInput = screen.getByLabelText(/due date/i);

      // Blank title
      fireEvent.change(titleInput, { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      expect(await screen.findByText('Title is required.')).toBeInTheDocument();

      // Invalid dates (due date earlier than start date)
      fireEvent.change(titleInput, { target: { value: 'Valid Title' } });
      fireEvent.change(dueInput, { target: { value: '2026-11-01' } }); // before start 2026-11-16
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      expect(await screen.findByText('Due date must be on or after the start date.')).toBeInTheDocument();

      // Cancel editing with unsaved changes: discard dialog appears
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);
      expect(screen.getByRole('heading', { level: 3, name: /discard changes\?/i })).toBeInTheDocument();

      // Confirm discard: editor closes without modifying original task on board
      fireEvent.click(screen.getByRole('button', { name: /^discard changes$/i }));
      expect(screen.queryByRole('heading', { level: 3, name: /edit task/i })).not.toBeInTheDocument();
      expect(screen.getByText('Plan the project launch')).toBeInTheDocument();
    });

    it('saves all 5 editable fields via updateTask and verifies they survive reload', async () => {
      let taskData = { ...initialTask };
      vi.spyOn(api.board, 'getBoardWithTasks').mockImplementation(async () => ({
        board: boardWithTask.board,
        tasks: [taskData],
      }));
      const updateSpy = vi.spyOn(api.board, 'updateTask').mockImplementation(async (input) => {
        taskData = {
          ...taskData,
          title: input.title ?? taskData.title,
          description: input.description !== undefined ? input.description : taskData.description,
          priority: input.priority !== undefined ? input.priority : taskData.priority,
          startDate: input.startDate !== undefined ? input.startDate : taskData.startDate,
          dueDate: input.dueDate !== undefined ? input.dueDate : taskData.dueDate,
        };
        return taskData;
      });

      const { unmount } = renderAt(`/tasks?boardId=${editBoardId}`);

      // Open and edit
      const editBtn = await screen.findByTestId('edit-task-button-task-orig-1');
      fireEvent.click(editBtn);

      const titleInput = await screen.findByLabelText(/title \*/i);
      const descInput = screen.getByLabelText(/description/i);
      const prioritySelect = screen.getByLabelText(/priority/i);
      const startInput = screen.getByLabelText(/start date/i);
      const dueInput = screen.getByLabelText(/due date/i);

      fireEvent.change(titleInput, { target: { value: 'Persisted Launch Title' } });
      fireEvent.change(descInput, { target: { value: 'Persisted Launch Description' } });
      fireEvent.change(prioritySelect, { target: { value: TaskPriority.Critical } });
      fireEvent.change(startInput, { target: { value: '2026-11-18' } });
      fireEvent.change(dueInput, { target: { value: '2026-11-25' } });

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await screen.findByTestId('task-updated-banner');
      expect(updateSpy).toHaveBeenCalledWith({
        taskId: 'task-orig-1',
        title: 'Persisted Launch Title',
        description: 'Persisted Launch Description',
        priority: TaskPriority.Critical,
        startDate: '2026-11-18T00:00:00.000Z',
        dueDate: '2026-11-25T00:00:00.000Z',
      });

      unmount();

      // Simulate full reload of board
      const reloadRender = renderAt(`/tasks?boardId=${editBoardId}`);
      expect(await reloadRender.findByText('Persisted Launch Title')).toBeInTheDocument();
      expect(reloadRender.getByText('CRITICAL')).toBeInTheDocument();

      // Reopen task details after reload and verify all 5 fields persisted
      const reloadedCard = await reloadRender.findByTestId('task-card-task-orig-1');
      fireEvent.click(reloadedCard);

      const detailsModal = await reloadRender.findByTestId('task-details-dialog');
      expect(within(detailsModal).getByText('Persisted Launch Title')).toBeInTheDocument();
      expect(within(detailsModal).getByText('Persisted Launch Description')).toBeInTheDocument();
      expect(within(detailsModal).getByText(/Priority: Critical/i)).toBeInTheDocument();
      expect(within(detailsModal).getByText(/Start date: Nov 18, 2026/i)).toBeInTheDocument();
      expect(within(detailsModal).getByText(/Due date: Nov 25, 2026/i)).toBeInTheDocument();
    });
  });

  describe('[US-16] Task Dependency Management', () => {
    const depBoardId = '01a1aad8-c24a-73f9-a095-069769796312';
    const taskAId = 'task-dep-a';
    const taskBId = 'task-dep-b';

    let taskA: TaskItem;
    let taskB: TaskItem;

    beforeEach(() => {
      taskA = {
        id: taskAId,
        readableId: 'TES-18',
        number: 18,
        boardId: depBoardId,
        title: 'Approve project scope',
        status: ColumnCategory.InProgress,
        columnId: 'col-progress',
        columnName: 'In Progress',
        priority: TaskPriority.High,
        assigneeIds: [],
        blockedBy: [],
        blocks: [],
      };

      taskB = {
        id: taskBId,
        readableId: 'TES-24',
        number: 24,
        boardId: depBoardId,
        title: 'Prepare the project launch',
        status: ColumnCategory.ToDo,
        columnId: 'col-todo',
        columnName: 'To Do',
        priority: TaskPriority.Medium,
        assigneeIds: [],
        blockedBy: [],
        blocks: [],
      };

      vi.spyOn(api.board, 'getBoardWithTasks').mockImplementation(async () => ({
        board: {
          id: depBoardId,
          projectId: 'p-1',
          projectName: 'Test Project',
          name: 'Dependency Board',
          columns: [
            { id: 'col-todo', name: 'To Do', category: ColumnCategory.ToDo, position: 'A' },
            { id: 'col-progress', name: 'In Progress', category: ColumnCategory.InProgress, position: 'B' },
          ],
        },
        tasks: [taskA, taskB],
      }));
    });

    it('creates predecessor relationship, displays correct direction on both tasks, persists after reload, and handles validation errors', async () => {
      vi.spyOn(api.board, 'addTaskDependency').mockImplementation(async (input) => {
        if (input.blockingTaskId === taskAId && input.blockedTaskId === taskBId) {
          taskA = {
            ...taskA,
            blocks: [{ id: taskB.id, readableId: taskB.readableId, title: taskB.title, status: taskB.status }],
          };
          taskB = {
            ...taskB,
            blockedBy: [{ id: taskA.id, readableId: taskA.readableId, title: taskA.title, status: taskA.status }],
          };
          return { blockingTask: taskA, blockedTask: taskB };
        }
        throw new ApiError('Invalid dependency', 400, null);
      });

      const { unmount } = renderAt(`/tasks?boardId=${depBoardId}`);

      // 1. Open task TES-24 details
      const detailsBtn = await screen.findByTestId(`open-task-${taskBId}`);
      fireEvent.click(detailsBtn);

      // 2. Select dependency management option
      const manageDepBtn = await screen.findByTestId('manage-dependencies-button');
      fireEvent.click(manageDepBtn);

      // Verify Dependency modal opens (State 01 / View)
      expect(screen.getByRole('heading', { level: 2, name: 'Task dependencies' })).toBeInTheDocument();
      expect(screen.getByText(/Blocked by · 0 tasks/i)).toBeInTheDocument();

      // Click "Add dependency" to enter selection mode (State 02)
      fireEvent.click(screen.getByRole('button', { name: 'Add dependency' }));
      expect(screen.getByText(/CURRENT TASK · TES-24 Prepare the project launch/i)).toBeInTheDocument();

      // 3. Select another task from the same project (TES-18)
      const candidateItem = await screen.findByTestId(`dependency-candidate-${taskAId}`);
      expect(candidateItem).toBeInTheDocument();
      fireEvent.click(candidateItem);

      // 4. Verify direction preview
      expect(
        screen.getByText('TES-18 · Approve project scope ↓ must happen before TES-24')
      ).toBeInTheDocument();

      // Submit dependency
      fireEvent.click(screen.getByRole('button', { name: 'Add dependency' }));

      // 5. Verify success banner and updated direction
      expect(await screen.findByText('✓ Dependency added')).toBeInTheDocument();

      // Close dependencies modal and task details
      fireEvent.click(screen.getByTestId('dependencies-bottom-close-btn'));
      fireEvent.click(screen.getByTestId('close-parent-task-details'));

      // Verify Task B card now shows Blocked badge
      expect(await screen.findByTestId(`blocked-by-badge-${taskBId}`)).toHaveTextContent('⏳ Blocked (1)');

      // Open Task B details and verify direction
      fireEvent.click(screen.getByTestId(`open-task-${taskBId}`));
      expect(await screen.findByTestId('task-dependencies-section')).toBeInTheDocument();
      expect(
        screen.getByText('TES-18 · Approve project scope ↓ must happen before TES-24')
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      // Open Task A details and verify it shows it blocks TES-24
      fireEvent.click(screen.getByTestId(`open-task-${taskAId}`));
      expect(await screen.findByTestId('task-dependencies-section')).toBeInTheDocument();
      expect(screen.getByText(/Blocks · 1 task/i)).toBeInTheDocument();
      expect(
        screen.getByText('TES-18 · Approve project scope ↓ must happen before TES-24')
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      // 6. Reload both tasks and confirm that the relationship remains visible
      unmount();
      const reloadRender = renderAt(`/tasks?boardId=${depBoardId}`);
      expect(await reloadRender.findByTestId(`blocked-by-badge-${taskBId}`)).toBeInTheDocument();

      const reloadTaskBBtn = await reloadRender.findByTestId(`open-task-${taskBId}`);
      fireEvent.click(reloadTaskBBtn);
      expect(await reloadRender.findByTestId('task-dependencies-section')).toBeInTheDocument();
      expect(
        reloadRender.getByText('TES-18 · Approve project scope ↓ must happen before TES-24')
      ).toBeInTheDocument();
    });

    it('[US-18] handles circular dependency error, preserves existing dependencies, and allows valid retry', async () => {
      const taskCId = 'task-dep-c';
      let taskC: TaskItem = {
        id: taskCId,
        readableId: 'TES-30',
        number: 30,
        boardId: depBoardId,
        title: 'Review launch checklist',
        status: ColumnCategory.ToDo,
        columnId: 'col-todo',
        columnName: 'To Do',
        priority: TaskPriority.Low,
        assigneeIds: [],
        blockedBy: [],
        blocks: [],
      };

      vi.spyOn(api.board, 'getBoardWithTasks').mockImplementation(async () => ({
        board: {
          id: depBoardId,
          projectId: 'p-1',
          projectName: 'Test Project',
          name: 'Dependency Board',
          columns: [
            { id: 'col-todo', name: 'To Do', category: ColumnCategory.ToDo, position: 'A' },
            { id: 'col-progress', name: 'In Progress', category: ColumnCategory.InProgress, position: 'B' },
          ],
        },
        tasks: [taskA, taskB, taskC],
      }));

      vi.spyOn(api.board, 'addTaskDependency').mockImplementation(async (input) => {
        if (input.blockingTaskId === taskAId && input.blockedTaskId === taskBId) {
          throw new ApiError(
            "TES-18 can't block TES-24: TES-24 already blocks TES-18 (TES-24 → TES-18), so this would create a cycle.",
            400,
            null
          );
        }
        if (input.blockingTaskId === taskCId && input.blockedTaskId === taskBId) {
          taskB = {
            ...taskB,
            blockedBy: [{ id: taskC.id, readableId: taskC.readableId, title: taskC.title, status: taskC.status }],
          };
          taskC = {
            ...taskC,
            blocks: [{ id: taskB.id, readableId: taskB.readableId, title: taskB.title, status: taskB.status }],
          };
          return { blockingTask: taskC, blockedTask: taskB };
        }
        throw new ApiError('Unexpected input', 400, null);
      });

      renderAt(`/tasks?boardId=${depBoardId}`);

      // 1. Open task TES-24 details and start adding dependency
      fireEvent.click(await screen.findByTestId(`open-task-${taskBId}`));
      fireEvent.click(await screen.findByTestId('manage-dependencies-button'));
      fireEvent.click(screen.getByRole('button', { name: 'Add dependency' }));

      // 2. Select circular candidate TES-18
      const candidateItem = await screen.findByTestId(`dependency-candidate-${taskAId}`);
      fireEvent.click(candidateItem);
      fireEvent.click(screen.getByRole('button', { name: 'Add dependency' }));

      // 3. Cycle rejected state (State 01): clear error message explaining why relationship cannot be created
      expect(await screen.findByTestId('cycle-error-banner')).toBeInTheDocument();
      expect(screen.getByText('This dependency creates a cycle.')).toBeInTheDocument();
      expect(screen.getByText('TES-18 already depends on TES-24. Choose another task.')).toBeInTheDocument();
      expect(screen.getByText(/Existing: TES-24 → TES-18/i)).toBeInTheDocument();
      expect(screen.getByText(/Rejected: TES-18 → TES-24/i)).toBeInTheDocument();

      // 4. Click Choose another task to correct selection (State 02)
      fireEvent.click(screen.getByTestId('choose-another-task-btn'));
      expect(screen.getByLabelText('Choose another task')).toBeInTheDocument();

      // The rejected candidate TES-18 is not offered
      expect(screen.queryByTestId(`dependency-candidate-${taskAId}`)).not.toBeInTheDocument();

      // 5. Select valid task TES-30 and retry
      const validCandidate = await screen.findByTestId(`dependency-candidate-${taskCId}`);
      fireEvent.click(validCandidate);

      const retryBtn = screen.getByRole('button', { name: 'Retry with TES-30' });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);

      // 6. Valid retry saved (State 03)
      expect(await screen.findByText('✓ Dependency added')).toBeInTheDocument();
      expect(screen.getByTestId('cycle-rejected-notice')).toHaveTextContent(
        'The rejected TES-18 link was never added.'
      );

      // Close modal and verify rejected task does NOT appear in task details, but valid task does
      fireEvent.click(screen.getByRole('button', { name: 'Back to task' }));
      expect(await screen.findByTestId('task-dependencies-section')).toBeInTheDocument();
      expect(screen.getByText('Blocked by · 1 task')).toBeInTheDocument();
      expect(screen.getByText('TES-30 · Review launch checklist ↓ must happen before TES-24')).toBeInTheDocument();
      expect(screen.queryByText(/TES-18 · Approve project scope ↓ must happen before TES-24/i)).not.toBeInTheDocument();
    });
  });
});
