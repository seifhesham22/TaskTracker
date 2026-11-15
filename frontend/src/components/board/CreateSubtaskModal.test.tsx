import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateSubtaskModal } from './CreateSubtaskModal';
import { ColumnCategory, type TaskItem } from '../../domain/models';

const mockParentTask: TaskItem = {
  id: 'task-parent-1',
  readableId: 'TES-24',
  number: 24,
  boardId: 'board-1',
  title: 'Prepare the project launch',
  status: ColumnCategory.InProgress,
  columnId: 'col-1',
  assigneeIds: [],
};

describe('CreateSubtaskModal', () => {
  it('does not render when closed or no parent task', () => {
    const { rerender } = render(
      <CreateSubtaskModal
        parentTask={mockParentTask}
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.queryByTestId('create-subtask-modal')).not.toBeInTheDocument();

    rerender(
      <CreateSubtaskModal
        parentTask={null}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.queryByTestId('create-subtask-modal')).not.toBeInTheDocument();
  });

  it('renders parent task context card and subtask form (State 02)', () => {
    render(
      <CreateSubtaskModal
        parentTask={mockParentTask}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId('create-subtask-modal')).toBeInTheDocument();
    expect(screen.getByText(/TEST PROJECT \/ TES-24/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create subtask/i })).toBeInTheDocument();
    expect(screen.getByText('PARENT TASK')).toBeInTheDocument();
    expect(screen.getByText('TES-24 · Prepare the project launch')).toBeInTheDocument();
    expect(screen.getByLabelText(/subtask title \*/i)).toBeInTheDocument();
    expect(
      screen.getByText(/the new subtask will appear under TES-24\./i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('submit-create-subtask')).toHaveTextContent('Create subtask');
  });

  it('validates required title on submit (State 03)', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <CreateSubtaskModal
        parentTask={mockParentTask}
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    const submitBtn = screen.getByTestId('submit-create-subtask');
    await user.click(submitBtn);

    expect(handleSubmit).not.toHaveBeenCalled();
    const errorMsg = await screen.findByTestId('subtask-title-error');
    expect(errorMsg).toHaveTextContent('Subtask title is required.');
    expect(screen.getByTestId('subtask-title-input')).toHaveClass('has-error');
  });

  it('calls onSubmit with valid title and closes on success (State 04 -> 05)', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSubmit = vi.fn().mockResolvedValue(true);

    render(
      <CreateSubtaskModal
        parentTask={mockParentTask}
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByTestId('subtask-title-input');
    await user.type(input, 'Prepare the release notes');

    const submitBtn = screen.getByTestId('submit-create-subtask');
    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith(mockParentTask, 'Prepare the release notes');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('displays error banner when submission fails and retains title (State 06)', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSubmit = vi.fn().mockResolvedValue(false);

    render(
      <CreateSubtaskModal
        parentTask={mockParentTask}
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const input = screen.getByTestId('subtask-title-input');
    await user.type(input, 'Failed subtask attempt');

    const submitBtn = screen.getByTestId('submit-create-subtask');
    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();

    const banner = await screen.findByTestId('create-subtask-server-error');
    expect(banner).toHaveTextContent('We couldn’t create the subtask. Try again.');
    expect(input).toHaveValue('Failed subtask attempt');
  });

  it('closes on cancel button click or escape key', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <CreateSubtaskModal
        parentTask={mockParentTask}
        isOpen={true}
        onClose={handleClose}
        onSubmit={vi.fn()}
      />
    );

    const cancelBtn = screen.getByTestId('cancel-create-subtask');
    await user.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
