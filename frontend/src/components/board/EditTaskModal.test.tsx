import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnCategory, type TaskItem, TaskPriority } from '../../domain/models';
import { EditTaskModal } from './EditTaskModal';

describe('EditTaskModal', () => {
  const sampleTask: TaskItem = {
    id: 't-123',
    readableId: 'TES-24',
    number: 24,
    boardId: 'b-1',
    title: 'Plan the project launch',
    description: 'Agree on milestones and assign the launch checklist',
    status: ColumnCategory.ToDo,
    columnId: 'c-todo',
    columnName: 'To do',
    priority: TaskPriority.Medium,
    assigneeIds: [],
    startDate: '2026-11-16T00:00:00Z',
    dueDate: '2026-11-20T00:00:00Z',
  };

  it('prefills existing task information across all five editable fields', () => {
    render(
      <EditTaskModal
        task={sampleTask}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/test project \/ tes-24/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /edit task/i })).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/title \*/i);
    expect(titleInput).toHaveValue('Plan the project launch');

    const descInput = screen.getByLabelText(/description/i);
    expect(descInput).toHaveValue('Agree on milestones and assign the launch checklist');

    const prioritySelect = screen.getByLabelText(/priority/i);
    expect(prioritySelect).toHaveValue(TaskPriority.Medium);

    const startInput = screen.getByLabelText(/start date/i);
    expect(startInput).toHaveValue('2026-11-16');

    const dueInput = screen.getByLabelText(/due date/i);
    expect(dueInput).toHaveValue('2026-11-20');

    expect(screen.getByText('23 / 200 characters')).toBeInTheDocument();
  });

  it('shows validation error when title is empty and prevents submit', async () => {
    const submitMock = vi.fn();
    render(
      <EditTaskModal
        task={sampleTask}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={submitMock}
      />
    );

    const titleInput = screen.getByLabelText(/title \*/i);
    fireEvent.change(titleInput, { target: { value: '   ' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('shows validation error when due date is before start date and prevents submit', async () => {
    const submitMock = vi.fn();
    render(
      <EditTaskModal
        task={sampleTask}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={submitMock}
      />
    );

    const dueInput = screen.getByLabelText(/due date/i);
    fireEvent.change(dueInput, { target: { value: '2026-11-10' } }); // before start date 2026-11-16

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    expect(
      await screen.findByText('Due date must be on or after the start date.')
    ).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('submits updated values when all 5 fields are modified and valid', async () => {
    const submitMock = vi.fn().mockResolvedValue({
      ...sampleTask,
      title: 'Updated launch title',
      description: 'Updated checklist description',
      priority: TaskPriority.High,
      startDate: '2026-11-18T00:00:00Z',
      dueDate: '2026-11-25T00:00:00Z',
    });
    const successMock = vi.fn();
    const closeMock = vi.fn();

    render(
      <EditTaskModal
        task={sampleTask}
        projectName="Test Project"
        isOpen={true}
        onClose={closeMock}
        onSubmit={submitMock}
        onSuccess={successMock}
      />
    );

    fireEvent.change(screen.getByLabelText(/title \*/i), {
      target: { value: 'Updated launch title' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Updated checklist description' },
    });
    fireEvent.change(screen.getByLabelText(/priority/i), {
      target: { value: TaskPriority.High },
    });
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-11-18' },
    });
    fireEvent.change(screen.getByLabelText(/due date/i), {
      target: { value: '2026-11-25' },
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith({
        taskId: 't-123',
        title: 'Updated launch title',
        description: 'Updated checklist description',
        priority: TaskPriority.High,
        startDate: '2026-11-18T00:00:00.000Z',
        dueDate: '2026-11-25T00:00:00.000Z',
      });
    });

    expect(successMock).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
  });

  it('prompts to discard changes when user cancels with unsaved edits', async () => {
    const closeMock = vi.fn();
    render(
      <EditTaskModal
        task={sampleTask}
        projectName="Test Project"
        isOpen={true}
        onClose={closeMock}
        onSubmit={vi.fn()}
      />
    );

    // Modify title
    fireEvent.change(screen.getByLabelText(/title \*/i), {
      target: { value: 'Different title' },
    });

    // Click Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Discard confirmation dialog appears
    expect(screen.getByRole('heading', { level: 3, name: /discard changes\?/i })).toBeInTheDocument();
    expect(screen.getByText(/your unsaved changes will be lost\./i)).toBeInTheDocument();
    expect(closeMock).not.toHaveBeenCalled();

    // Click Keep editing: returns to form with edits intact
    fireEvent.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(screen.queryByRole('heading', { level: 3, name: /discard changes\?/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/title \*/i)).toHaveValue('Different title');

    // Click Cancel again and Discard changes: closes editor
    fireEvent.click(cancelButton);
    fireEvent.click(screen.getByRole('button', { name: /^discard changes$/i }));
    expect(closeMock).toHaveBeenCalled();
  });

  it('closes immediately without discard prompt when no changes were made', () => {
    const closeMock = vi.fn();
    render(
      <EditTaskModal
        task={sampleTask}
        projectName="Test Project"
        isOpen={true}
        onClose={closeMock}
        onSubmit={vi.fn()}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(closeMock).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { level: 3, name: /discard changes\?/i })).not.toBeInTheDocument();
  });

  it('displays server error banner and retains draft values on request failure', async () => {
    const submitMock = vi.fn().mockRejectedValue(new Error('Server error updating task'));
    render(
      <EditTaskModal
        task={sampleTask}
        projectName="Test Project"
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={submitMock}
      />
    );

    fireEvent.change(screen.getByLabelText(/title \*/i), {
      target: { value: 'Draft title to retain' },
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error updating task');
    expect(screen.getByLabelText(/title \*/i)).toHaveValue('Draft title to retain');
  });

  it('renders skeleton loading placeholders when isLoading is true', () => {
    render(
      <EditTaskModal
        task={sampleTask}
        projectName="Test Project"
        isOpen={true}
        isLoading={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/loading task details/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /loading…/i })).toBeDisabled();
  });
});
