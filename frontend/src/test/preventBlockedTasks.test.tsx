import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, BlockedTaskStartApiError } from '../api';
import { routes } from '../app/routes';
import { ColumnCategory, type TaskItem, TaskPriority } from '../domain/models';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('[US-17] Prevent blocked tasks from starting (T1WOR-158)', () => {
  const mockBoardData = {
    board: {
      id: '01a18766-48b5-7fb8-a04c-13e1bf648def',
      projectId: 'proj-1',
      projectName: 'Website redesign',
      name: 'Website redesign board',
      userRole: 'Writer',
      columns: [
        { id: 'c-todo', name: 'To do', category: ColumnCategory.ToDo, position: '0' },
        { id: 'c-inprogress', name: 'In progress', category: ColumnCategory.InProgress, position: '1' },
        { id: 'c-done', name: 'Done', category: ColumnCategory.Done, position: '2' },
      ],
      members: [
        { userId: 'u-1', userName: 'alice@example.com', role: 'Owner' },
        { userId: 'u-2', userName: 'bob@example.com', role: 'Writer' },
      ],
    },
    tasks: [
      {
        id: 't-24',
        readableId: 'TES-24',
        number: 24,
        boardId: '01a18766-48b5-7fb8-a04c-13e1bf648def',
        title: 'Prepare launch checklist',
        description: 'Checklist for release',
        status: ColumnCategory.ToDo,
        columnId: 'c-todo',
        columnName: 'To do',
        priority: TaskPriority.High,
        assignees: [],
        assigneeIds: [],
        blockedBy: [
          {
            id: 't-18',
            readableId: 'TES-18',
            title: 'Approve scope',
            status: ColumnCategory.InProgress,
          },
        ],
        blocks: [],
      } as TaskItem,
      {
        id: 't-18',
        readableId: 'TES-18',
        number: 18,
        boardId: '01a18766-48b5-7fb8-a04c-13e1bf648def',
        title: 'Approve scope',
        description: 'Scope approval',
        status: ColumnCategory.InProgress,
        columnId: 'c-inprogress',
        columnName: 'In progress',
        priority: TaskPriority.Medium,
        assignees: [],
        assigneeIds: [],
        blockedBy: [],
        blocks: [
          {
            id: 't-24',
            readableId: 'TES-24',
            title: 'Prepare launch checklist',
            status: ColumnCategory.ToDo,
          },
        ],
      } as TaskItem,
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prevents moving a blocked task to In Progress, reverts optimistic move, and explains blockers', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardData);
    const moveSpy = vi.spyOn(api.board, 'moveTask').mockRejectedValue(
      new BlockedTaskStartApiError(
        "TES-24 is blocked by this unfinished task: TES-18 (Approve scope). It can't be started until that task is done.",
        [
          {
            id: 't-18',
            readableId: 'TES-18',
            title: 'Approve scope',
          },
        ],
        {}
      )
    );

    renderAt('/tasks');

    // Wait for the task card to be rendered in the board
    const taskCard = await screen.findByTestId('task-card-t-24');
    expect(taskCard).toBeInTheDocument();

    // Drag and drop task-24 onto In Progress column
    const inProgressColumn = screen.getByTestId('board-column-IN_PROGRESS');
    fireEvent.drop(inProgressColumn, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/x-task-id' ? 't-24' : ''),
      },
    });

    await waitFor(() => {
      expect(moveSpy).toHaveBeenCalledWith({
        taskId: 't-24',
        columnId: 'c-inprogress',
      });
    });

    // Verify optimistic move was reverted: Task card remains in To do column
    const todoColumn = screen.getByTestId('board-column-TO_DO');
    expect(todoColumn).toContainElement(screen.getByTestId('task-card-t-24'));

    // Verify rollback banner
    const rollbackAlert = await screen.findByTestId('board-move-error');
    expect(rollbackAlert).toHaveTextContent('Move reverted · TES-24 stays in To do.');

    // Verify BlockedTaskStartModal is open with explanation
    expect(screen.getByTestId('blocked-task-start-modal')).toBeInTheDocument();
    expect(screen.getByTestId('blocked-start-explanation-banner')).toHaveTextContent(
      'This task can’t start yet. Complete its prerequisites.'
    );
    expect(screen.getByTestId('blocker-item-t-18')).toHaveTextContent('TES-18 · Approve scope');
    expect(screen.getByTestId('check-again-btn')).toBeInTheDocument();
  });

  it('allows navigating to the blocker task details and returning back to blocked task explanation', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardData);
    vi.spyOn(api.board, 'moveTask').mockRejectedValue(
      new BlockedTaskStartApiError(
        "TES-24 is blocked by this unfinished task: TES-18 (Approve scope).",
        [
          {
            id: 't-18',
            readableId: 'TES-18',
            title: 'Approve scope',
          },
        ],
        {}
      )
    );

    renderAt('/tasks');

    const inProgressColumn = await screen.findByTestId('board-column-IN_PROGRESS');
    fireEvent.drop(inProgressColumn, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/x-task-id' ? 't-24' : ''),
      },
    });

    // Wait for modal to appear
    await screen.findByTestId('blocked-task-start-modal');

    // Click "Open blocker"
    const openBlockerBtn = screen.getByTestId('open-blocker-t-18');
    fireEvent.click(openBlockerBtn);

    // Verify State 04: Prerequisite detail view
    const prereqView = screen.getByTestId('prerequisite-detail-view');
    expect(prereqView).toBeInTheDocument();
    expect(within(prereqView).getByText('Approve scope')).toBeInTheDocument();
    expect(screen.getByTestId('prerequisite-blocks-banner')).toHaveTextContent(
      'This task blocks TES-24.'
    );

    // Click "Back to blocked task"
    const backBtn = screen.getByTestId('back-to-blocked-task-btn');
    fireEvent.click(backBtn);

    // Returned to blocked task explanation
    expect(screen.queryByTestId('prerequisite-detail-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('blocked-start-explanation-banner')).toBeInTheDocument();
  });

  it('allows starting the task when all blockers are completed or removed', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardData);
    const moveSpy = vi.spyOn(api.board, 'moveTask')
      .mockRejectedValueOnce(
        new BlockedTaskStartApiError(
          "TES-24 is blocked by this unfinished task: TES-18 (Approve scope).",
          [{ id: 't-18', readableId: 'TES-18', title: 'Approve scope' }],
          {}
        )
      )
      .mockResolvedValueOnce({
        ...mockBoardData.tasks[0],
        status: ColumnCategory.InProgress,
        columnId: 'c-inprogress',
        columnName: 'In progress',
      });

    renderAt('/tasks');

    const inProgressColumn = await screen.findByTestId('board-column-IN_PROGRESS');
    fireEvent.drop(inProgressColumn, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/x-task-id' ? 't-24' : ''),
      },
    });

    await screen.findByTestId('blocked-task-start-modal');

    // Now simulate that the blocker task TES-18 has been completed in the backend
    const updatedBoardData = {
      ...mockBoardData,
      tasks: [
        {
          ...mockBoardData.tasks[0],
          blockedBy: [
            {
              id: 't-18',
              readableId: 'TES-18',
              title: 'Approve scope',
              status: ColumnCategory.Done,
            },
          ],
        },
        {
          ...mockBoardData.tasks[1],
          status: ColumnCategory.Done,
          columnId: 'c-done',
          columnName: 'Done',
        },
      ],
    };
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(updatedBoardData);

    // User clicks "Check again"
    const checkAgainBtn = screen.getByTestId('check-again-btn');
    fireEvent.click(checkAgainBtn);

    // Verify State 06: All blockers resolved
    await waitFor(() => {
      expect(screen.getByTestId('all-prerequisites-complete-banner')).toHaveTextContent(
        'All prerequisites are complete or removed.'
      );
    });

    const startTaskBtn = screen.getByTestId('start-task-btn');
    expect(startTaskBtn).toBeInTheDocument();

    // User starts task
    fireEvent.click(startTaskBtn);

    await waitFor(() => {
      expect(moveSpy).toHaveBeenCalledTimes(2);
    });

    // Verify State 07: Start confirmed
    expect(screen.getByTestId('task-started-banner')).toHaveTextContent('✓ Task started');
    expect(screen.getByTestId('blocked-task-status-badge')).toHaveTextContent('In progress');

    // Click "Back to board"
    fireEvent.click(screen.getByTestId('back-to-board-btn'));

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByTestId('blocked-task-start-modal')).not.toBeInTheDocument();
    });
  });

  it('displays State 08 failure banner when recheck fails and allows retrying', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks')
      .mockResolvedValueOnce(mockBoardData)
      .mockRejectedValueOnce(new Error('Network error during recheck'));

    vi.spyOn(api.board, 'moveTask').mockRejectedValue(
      new BlockedTaskStartApiError(
        "TES-24 is blocked by this unfinished task: TES-18 (Approve scope).",
        [{ id: 't-18', readableId: 'TES-18', title: 'Approve scope' }],
        {}
      )
    );

    renderAt('/tasks');

    const inProgressColumn = await screen.findByTestId('board-column-IN_PROGRESS');
    fireEvent.drop(inProgressColumn, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/x-task-id' ? 't-24' : ''),
      },
    });

    await screen.findByTestId('blocked-task-start-modal');

    // Click "Check again"
    fireEvent.click(screen.getByTestId('check-again-btn'));

    // Verify State 08: Verification failure
    await waitFor(() => {
      expect(screen.getByTestId('verification-failure-banner')).toHaveTextContent(
        'Couldn’t verify prerequisites. The task was not started.'
      );
    });

    expect(screen.getByTestId('try-again-btn')).toBeInTheDocument();
  });
});
