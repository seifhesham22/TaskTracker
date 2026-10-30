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

  it('shows "Title is required" under title when title is empty', async () => {
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

    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('shows "Title is required" under title when title contains only spaces and disappears when fixed', async () => {
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
    fireEvent.change(titleInput, { target: { value: '     ' } });

    const submitBtn = screen.getByRole('button', { name: /^create task$/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Title is required')).toBeInTheDocument();

    // "An error disappears as soon as the field is fixed."
    fireEvent.change(titleInput, { target: { value: 'Valid Title' } });
    expect(screen.queryByText('Title is required')).toBeNull();
  });

  it('shows server reason under assignee when assignee is not in project, disappears when fixed', () => {
    render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        serverError="User '01a18766' is not a member of project TES, so they can't be assigned to this task."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByText("User '01a18766' is not a member of project TES, so they can't be assigned to this task.")
    ).toBeInTheDocument();

    // Change assignee to fix error
    const assigneeSelect = screen.getByLabelText(/assignee/i);
    fireEvent.change(assigneeSelect, { target: { value: 'u-1' } });

    expect(
      screen.queryByText("User '01a18766' is not a member of project TES, so they can't be assigned to this task.")
    ).toBeNull();
  });

  it('shows "Board not found" when board no longer exists', () => {
    render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        serverError="Board 'b-1' was not found."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Board not found')).toBeInTheDocument();
  });

  it('shows general error at top of form and preserves typed values on network/server failure', () => {
    const submitSpy = vi.fn().mockResolvedValue(false);

    render(
      <CreateTaskForm
        boardId="b-1"
        members={mockMembers}
        isOpen={true}
        isSubmitting={false}
        serverError="Network connection lost. Please try again."
        onClose={vi.fn()}
        onSubmit={submitSpy}
      />
    );

    const titleInput = screen.getByLabelText(/title/i);
    const descInput = screen.getByLabelText(/description/i);

    fireEvent.change(titleInput, { target: { value: 'Offline title' } });
    fireEvent.change(descInput, { target: { value: 'Offline description' } });

    expect(screen.getByText('Network connection lost. Please try again.')).toBeInTheDocument();
    expect(titleInput).toHaveValue('Offline title');
    expect(descInput).toHaveValue('Offline description');
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
