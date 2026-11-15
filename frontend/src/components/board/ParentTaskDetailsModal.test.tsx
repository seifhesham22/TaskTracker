import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnCategory, TaskPriority, type BoardColumnModel, type TaskItem } from '../../domain/models';
import { ParentTaskDetailsModal } from './ParentTaskDetailsModal';

const mockColumns: BoardColumnModel[] = [
  { id: 'col-todo', name: 'To Do', category: ColumnCategory.ToDo, position: 'A' },
  { id: 'col-prog', name: 'In Progress', category: ColumnCategory.InProgress, position: 'B' },
  { id: 'col-done', name: 'Done', category: ColumnCategory.Done, position: 'C' },
];

const mockParentTask: TaskItem = {
  id: 'parent-1',
  readableId: 'TES-24',
  number: 24,
  boardId: 'b-1',
  title: 'Prepare launch presentation',
  description: 'Coordinate slides and launch checklist',
  status: ColumnCategory.InProgress,
  columnId: 'col-prog',
  columnName: 'In Progress',
  priority: TaskPriority.High,
  assigneeIds: [],
};

const mockSubtasks: TaskItem[] = [
  {
    id: 'sub-1',
    readableId: 'TES-25',
    number: 25,
    boardId: 'b-1',
    title: 'Finalize presentation slides',
    status: ColumnCategory.Done,
    columnId: 'col-done',
    columnName: 'Done',
    parentTaskId: 'parent-1',
    assigneeIds: [],
  },
  {
    id: 'sub-2',
    readableId: 'TES-26',
    number: 26,
    boardId: 'b-1',
    title: 'Review launch checklist',
    status: ColumnCategory.InProgress,
    columnId: 'col-prog',
    columnName: 'In Progress',
    parentTaskId: 'parent-1',
    assigneeIds: [],
  },
  {
    id: 'sub-3',
    readableId: 'TES-27',
    number: 27,
    boardId: 'b-1',
    title: 'Confirm release date',
    status: ColumnCategory.ToDo,
    columnId: 'col-todo',
    columnName: 'To Do',
    parentTaskId: 'parent-1',
    assigneeIds: [],
  },
];

describe('ParentTaskDetailsModal', () => {
  it('renders parent task details and subtasks list (State 01)', () => {
    render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[mockParentTask, ...mockSubtasks]}
        columns={mockColumns}
        isOpen={true}
        onClose={vi.fn()}
        onMarkComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Prepare launch presentation')).toBeInTheDocument();
    expect(screen.getByText('Coordinate slides and launch checklist')).toBeInTheDocument();
    expect(screen.getByTestId('parent-status-badge')).toHaveTextContent('In Progress');
    expect(screen.getByTestId('subtasks-completion-count')).toHaveTextContent('1 / 3 done');
    expect(screen.getByTestId('mark-complete-button')).toBeEnabled();
    expect(screen.getByText('Review launch checklist')).toBeInTheDocument();
    expect(screen.getByText('Confirm release date')).toBeInTheDocument();
  });

  it('clicking Add subtask calls onAddSubtask', async () => {
    const user = userEvent.setup();
    const onAddSubtask = vi.fn();

    render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[mockParentTask, ...mockSubtasks]}
        columns={mockColumns}
        isOpen={true}
        onClose={vi.fn()}
        onMarkComplete={vi.fn()}
        onAddSubtask={onAddSubtask}
      />
    );

    const addBtn = screen.getByTestId('add-subtask-button');
    await user.click(addBtn);

    expect(onAddSubtask).toHaveBeenCalledTimes(1);
  });

  it('displays blocked banner and identifies incomplete subtasks when blockedError is present (State 02)', () => {
    const blockedError = {
      taskId: 'parent-1',
      message: "TES-24 can't be completed while these 2 subtasks are not done: TES-26, TES-27.",
      incompleteSubtasks: [
        { id: 'sub-2', readableId: 'TES-26', title: 'Review launch checklist' },
        { id: 'sub-3', readableId: 'TES-27', title: 'Confirm release date' },
      ],
    };

    render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[mockParentTask, ...mockSubtasks]}
        columns={mockColumns}
        isOpen={true}
        blockedError={blockedError}
        onClose={vi.fn()}
        onMarkComplete={vi.fn()}
      />
    );

    // Banner
    const banner = screen.getByTestId('parent-completion-blocked-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText('Complete 2 subtasks first')).toBeInTheDocument();
    expect(
      screen.getByText('This parent task can’t be completed while its subtasks are still in progress.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('parent-completion-error-message')).toHaveTextContent(
      "TES-24 can't be completed while these 2 subtasks are not done: TES-26, TES-27."
    );

    // Incomplete children identified
    expect(screen.getByText('Incomplete subtasks')).toBeInTheDocument();
    expect(screen.getByTestId('subtasks-count')).toHaveTextContent('2 remaining');
    expect(screen.getByTestId('incomplete-subtask-sub-2')).toBeInTheDocument();
    expect(screen.getByTestId('incomplete-subtask-sub-3')).toBeInTheDocument();
    expect(
      screen.getByText('Open each subtask above to finish the remaining work.')
    ).toBeInTheDocument();

    // Parent status remains In progress
    expect(screen.getByTestId('parent-status-badge')).toHaveTextContent('In Progress');

    // Back to task button is present
    expect(screen.getByTestId('back-to-task-button')).toBeInTheDocument();
  });

  it('displays "Complete 1 subtask first" when 1 subtask remains (State 03)', () => {
    const blockedError = {
      taskId: 'parent-1',
      message: "TES-24 can't be completed while this subtask is not done: TES-27.",
      incompleteSubtasks: [
        { id: 'sub-3', readableId: 'TES-27', title: 'Confirm release date' },
      ],
    };

    render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[mockParentTask, ...mockSubtasks]}
        columns={mockColumns}
        isOpen={true}
        blockedError={blockedError}
        onClose={vi.fn()}
        onMarkComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Complete 1 subtask first')).toBeInTheDocument();
    expect(screen.getByTestId('subtasks-count')).toHaveTextContent('1 remaining');
  });

  it('clicking Back to task dismisses blocked banner and calls onClearBlockedError', async () => {
    const user = userEvent.setup();
    const onClearBlockedError = vi.fn();

    const blockedError = {
      taskId: 'parent-1',
      message: 'Blocked',
      incompleteSubtasks: [{ id: 'sub-2', readableId: 'TES-26', title: 'Review launch checklist' }],
    };

    render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[mockParentTask, ...mockSubtasks]}
        columns={mockColumns}
        isOpen={true}
        blockedError={blockedError}
        onClose={vi.fn()}
        onMarkComplete={vi.fn()}
        onClearBlockedError={onClearBlockedError}
      />
    );

    await user.click(screen.getByTestId('back-to-task-button'));

    expect(onClearBlockedError).toHaveBeenCalled();
    expect(screen.queryByTestId('parent-completion-blocked-banner')).not.toBeInTheDocument();
  });

  it('navigates to focused subtask view and allows completing it', async () => {
    const user = userEvent.setup();
    const onMoveSubtask = vi.fn().mockResolvedValue(true);

    render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[mockParentTask, ...mockSubtasks]}
        columns={mockColumns}
        isOpen={true}
        onClose={vi.fn()}
        onMarkComplete={vi.fn()}
        onMoveSubtask={onMoveSubtask}
      />
    );

    // Click Open subtask on sub-2
    await user.click(screen.getByTestId('open-subtask-sub-2'));

    // Subtask detail view appears
    expect(screen.getByTestId('subtask-detail-view-sub-2')).toBeInTheDocument();
    expect(screen.getByText('Subtask · TES-26')).toBeInTheDocument();

    // Click complete subtask
    await user.click(screen.getByTestId('complete-subtask-btn'));
    expect(onMoveSubtask).toHaveBeenCalledWith('sub-2', 'col-done');

    // Click back to parent
    await user.click(screen.getByTestId('back-to-parent-btn'));
    expect(screen.queryByTestId('subtask-detail-view-sub-2')).not.toBeInTheDocument();
  });

  it('displays "All subtasks are complete." when all children are done (State 04)', () => {
    const allDoneSubtasks: TaskItem[] = mockSubtasks.map((st) => ({
      ...st,
      status: ColumnCategory.Done,
      columnId: 'col-done',
    }));

    render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[mockParentTask, ...allDoneSubtasks]}
        columns={mockColumns}
        isOpen={true}
        onClose={vi.fn()}
        onMarkComplete={vi.fn()}
      />
    );

    expect(screen.getByTestId('all-subtasks-complete-banner')).toBeInTheDocument();
    expect(screen.getByText('All subtasks are complete.')).toBeInTheDocument();
    expect(screen.getByTestId('subtasks-completion-count')).toHaveTextContent('3 / 3 done');
    expect(screen.getByTestId('mark-complete-button')).toBeEnabled();
  });

  it('displays completed state when parent task is done (State 06)', () => {
    const doneParentTask: TaskItem = {
      ...mockParentTask,
      status: ColumnCategory.Done,
      columnId: 'col-done',
    };

    render(
      <ParentTaskDetailsModal
        task={doneParentTask}
        allTasks={[doneParentTask, ...mockSubtasks]}
        columns={mockColumns}
        isOpen={true}
        onClose={vi.fn()}
        onMarkComplete={vi.fn()}
      />
    );

    expect(screen.getByTestId('task-completed-banner')).toBeInTheDocument();
    expect(screen.getByText('✓ Task completed')).toBeInTheDocument();
    expect(screen.getByTestId('parent-status-badge')).toHaveTextContent('Done');
    expect(screen.getByTestId('close-task-details-button')).toBeInTheDocument();
  });
});
