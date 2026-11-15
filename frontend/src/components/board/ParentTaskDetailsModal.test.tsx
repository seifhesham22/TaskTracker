import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ParentTaskDetailsModal } from './ParentTaskDetailsModal';
import { ColumnCategory, type TaskItem } from '../../domain/models';

const mockParentTask: TaskItem = {
  id: 'task-parent-1',
  readableId: 'TES-24',
  number: 24,
  boardId: 'board-1',
  title: 'Prepare the project launch',
  description: 'Agree on milestones and assign the launch checklist.',
  status: ColumnCategory.InProgress,
  columnId: 'col-1',
  columnName: 'In progress',
  assigneeIds: [],
};

const mockSubtasks: TaskItem[] = [
  {
    id: 'sub-1',
    readableId: 'TES-25',
    number: 25,
    boardId: 'board-1',
    title: 'Agree on launch milestones',
    status: ColumnCategory.Done,
    columnId: 'col-done',
    columnName: 'Done',
    parentTaskId: 'task-parent-1',
    assigneeIds: [],
  },
  {
    id: 'sub-2',
    readableId: 'TES-26',
    number: 26,
    boardId: 'board-1',
    title: 'Review the launch checklist',
    status: ColumnCategory.ToDo,
    columnId: 'col-todo',
    columnName: 'To do',
    parentTaskId: 'task-parent-1',
    assigneeIds: [],
  },
  {
    id: 'sub-3',
    readableId: 'TES-27',
    number: 27,
    boardId: 'board-1',
    title: 'Confirm the release date',
    status: ColumnCategory.ToDo,
    columnId: 'col-todo',
    columnName: 'To do',
    parentTaskId: 'task-parent-1',
    assigneeIds: [],
  },
];

describe('ParentTaskDetailsModal', () => {
  it('does not render when closed or task is null', () => {
    const { rerender } = render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[]}
        isOpen={false}
        onClose={vi.fn()}
        onAddSubtask={vi.fn()}
      />
    );
    expect(screen.queryByTestId('parent-task-details-modal')).not.toBeInTheDocument();

    rerender(
      <ParentTaskDetailsModal
        task={null}
        allTasks={[]}
        isOpen={true}
        onClose={vi.fn()}
        onAddSubtask={vi.fn()}
      />
    );
    expect(screen.queryByTestId('parent-task-details-modal')).not.toBeInTheDocument();
  });

  it('renders parent task information and subtasks with completion count (State 01)', () => {
    render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[mockParentTask, ...mockSubtasks]}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onAddSubtask={vi.fn()}
      />
    );

    expect(screen.getByTestId('parent-task-details-modal')).toBeInTheDocument();
    expect(screen.getByText(/TEST PROJECT \/ TES-24/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prepare the project launch' })).toBeInTheDocument();
    expect(screen.getByText('Agree on milestones and assign the launch checklist.')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Subtasks' })).toBeInTheDocument();
    expect(screen.getByTestId('subtasks-completion-count')).toHaveTextContent('1 / 3 done');

    expect(screen.getByTestId('subtask-item-sub-1')).toHaveTextContent('TES-25 · Done');
    expect(screen.getByTestId('subtask-item-sub-1')).toHaveTextContent('Agree on launch milestones');

    expect(screen.getByTestId('subtask-item-sub-2')).toHaveTextContent('TES-26 · To do');
    expect(screen.getByTestId('subtask-item-sub-2')).toHaveTextContent('Review the launch checklist');

    expect(screen.getByTestId('subtask-item-sub-3')).toHaveTextContent('TES-27 · To do');
    expect(screen.getByTestId('subtask-item-sub-3')).toHaveTextContent('Confirm the release date');

    expect(screen.getByTestId('add-subtask-button')).toHaveTextContent('Add subtask');
  });

  it('renders success banner when showSuccessBanner is true (State 05)', () => {
    render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[mockParentTask, ...mockSubtasks]}
        isOpen={true}
        showSuccessBanner={true}
        onClose={vi.fn()}
        onAddSubtask={vi.fn()}
      />
    );

    const banner = screen.getByTestId('subtask-created-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('✓ Subtask created');
  });

  it('triggers onAddSubtask when Add subtask button is clicked', async () => {
    const user = userEvent.setup();
    const handleAddSubtask = vi.fn();

    render(
      <ParentTaskDetailsModal
        task={mockParentTask}
        allTasks={[mockParentTask]}
        isOpen={true}
        onClose={vi.fn()}
        onAddSubtask={handleAddSubtask}
      />
    );

    const addBtn = screen.getByTestId('add-subtask-button');
    await user.click(addBtn);

    expect(handleAddSubtask).toHaveBeenCalledTimes(1);
  });
});
