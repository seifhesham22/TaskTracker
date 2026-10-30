import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateTaskForm } from './CreateTaskForm';
import { TaskPriority } from '../../domain/models';

describe('CreateTaskForm Component', () => {
  const mockMembers = [
    { userId: 'u-1', userName: 'admin@local.test', email: 'admin@local.test' },
    { userId: 'u-2', userName: 'user1@local.test', email: 'user1@local.test' },
  ];

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={false}
        isSubmitting={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders all form fields: title, description, assignee, priority, due date', () => {
    render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assignee/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
  });

  it('populates assignee select with only project members', () => {
    render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const select = screen.getByLabelText(/assignee/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((opt) => opt.textContent);

    expect(options).toEqual(['Unassigned', 'admin@local.test', 'user1@local.test']);
  });

  it('prevents submission when title is empty and shows clear message', async () => {
    const submitSpy = vi.fn();

    render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        onClose={vi.fn()}
        onSubmit={submitSpy}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /^create task$/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Title is required and cannot be empty.')).toBeInTheDocument();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('prevents submission when title contains only whitespace', async () => {
    const submitSpy = vi.fn();

    render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        onClose={vi.fn()}
        onSubmit={submitSpy}
      />
    );

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: '    ' } });

    const submitBtn = screen.getByRole('button', { name: /^create task$/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Title is required and cannot be empty.')).toBeInTheDocument();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('submits with title only and leaves optional fields undefined', async () => {
    const submitSpy = vi.fn().mockResolvedValue(true);
    const closeSpy = vi.fn();

    render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        onClose={closeSpy}
        onSubmit={submitSpy}
      />
    );

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Title only task' } });

    const submitBtn = screen.getByRole('button', { name: /^create task$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith({
        boardId: 'b-1',
        title: 'Title only task',
        description: undefined,
        assigneeId: undefined,
        priority: undefined,
        dueDate: undefined,
      });
    });

    expect(closeSpy).toHaveBeenCalled();
  });

  it('submits with all 5 fields filled in correctly', async () => {
    const submitSpy = vi.fn().mockResolvedValue(true);
    const closeSpy = vi.fn();

    render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        onClose={closeSpy}
        onSubmit={submitSpy}
      />
    );

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Complete task' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Detailed notes' } });
    fireEvent.change(screen.getByLabelText(/assignee/i), { target: { value: 'u-1' } });
    fireEvent.change(screen.getByLabelText(/priority/i), { target: { value: TaskPriority.Critical } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: '2026-11-20' } });

    const submitBtn = screen.getByRole('button', { name: /^create task$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith({
        boardId: 'b-1',
        title: 'Complete task',
        description: 'Detailed notes',
        assigneeId: 'u-1',
        priority: TaskPriority.Critical,
        dueDate: new Date('2026-11-20').toISOString(),
      });
    });

    expect(closeSpy).toHaveBeenCalled();
  });

  it('preserves user input and shows error message when server rejects creation', async () => {
    const submitSpy = vi.fn().mockResolvedValue(false);

    const { rerender } = render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        serverError={null}
        onClose={vi.fn()}
        onSubmit={submitSpy}
      />
    );

    const titleInput = screen.getByLabelText(/title/i);
    const descInput = screen.getByLabelText(/description/i);

    fireEvent.change(titleInput, { target: { value: 'Failed task' } });
    fireEvent.change(descInput, { target: { value: 'Should stay typed' } });

    const submitBtn = screen.getByRole('button', { name: /^create task$/i });
    fireEvent.click(submitBtn);

    rerender(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        serverError="Title is invalid per project policy"
        onClose={vi.fn()}
        onSubmit={submitSpy}
      />
    );

    expect(screen.getByText('Title is invalid per project policy')).toBeInTheDocument();
    expect(titleInput).toHaveValue('Failed task');
    expect(descInput).toHaveValue('Should stay typed');
  });

  it('calls onClose when clicking Cancel button or backdrop', () => {
    const closeSpy = vi.fn();

    const { container } = render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        onClose={closeSpy}
        onSubmit={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(closeSpy).toHaveBeenCalledTimes(1);

    const backdrop = container.querySelector('.create-task-modal-backdrop');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(closeSpy).toHaveBeenCalledTimes(2);
    }
  });
});

