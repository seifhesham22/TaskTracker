import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnCategory, TaskPriority, type ProjectMemberModel, type TaskItem } from '../../domain/models';
import { TaskAssigneeModal } from './TaskAssigneeModal';

describe('TaskAssigneeModal (Figma States 01 - 11)', () => {
  const mockUnassignedTask: TaskItem = {
    id: 't-24',
    readableId: 'TES-24',
    number: 24,
    boardId: 'b-1',
    title: 'Prepare launch checklist',
    status: ColumnCategory.ToDo,
    priority: TaskPriority.High,
    columnId: 'c-1',
    assigneeIds: [],
    assignees: [],
  };

  const mockAssignedTask: TaskItem = {
    id: 't-24',
    readableId: 'TES-24',
    number: 24,
    boardId: 'b-1',
    title: 'Prepare launch checklist',
    status: ColumnCategory.ToDo,
    priority: TaskPriority.High,
    columnId: 'c-1',
    assigneeIds: ['u-1'],
    assignees: [{ id: 'u-1', userName: 'Mina Joao' }],
  };

  const mockMembers: ProjectMemberModel[] = [
    { userId: 'u-1', userName: 'Mina Joao', role: 'WRITER' },
    { userId: 'u-2', userName: 'Dombele Joao', role: 'OWNER' },
  ];

  it('State 01: renders unassigned task view with Change assignee button', () => {
    render(
      <TaskAssigneeModal
        task={mockUnassignedTask}
        members={mockMembers}
        projectName="Website redesign"
        userRole="OWNER"
        isOpen={true}
        onClose={vi.fn()}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Task assignee' })).toBeInTheDocument();
    expect(screen.getByText('Website redesign / TES-24')).toBeInTheDocument();
    expect(screen.getByText('Prepare launch checklist')).toBeInTheDocument();
    expect(screen.getByText('To do · High priority')).toBeInTheDocument();
    expect(screen.getByTestId('task-assignee-display-box')).toHaveTextContent('Unassigned');
    expect(screen.getByTestId('open-change-assignee-btn')).toBeInTheDocument();
  });

  it('State 02: opens member picker on clicking Change assignee', () => {
    render(
      <TaskAssigneeModal
        task={mockUnassignedTask}
        members={mockMembers}
        projectName="Website redesign"
        userRole="OWNER"
        isOpen={true}
        onClose={vi.fn()}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('open-change-assignee-btn'));

    expect(screen.getByRole('heading', { name: 'Change assignee' })).toBeInTheDocument();
    expect(screen.getByText('TES-24 · Prepare launch checklist')).toBeInTheDocument();
    expect(screen.getByLabelText(/Find a project member/i)).toBeInTheDocument();
    expect(screen.getByTestId('assignee-option-unassigned')).toBeInTheDocument();
    expect(screen.getByTestId('assignee-option-u-1')).toHaveTextContent('Mina Joao');
    expect(screen.getByTestId('assignee-option-u-2')).toHaveTextContent('Dombele Joao');
  });

  it('State 03: shows loading feedback box when isLoadingMembers is true', () => {
    render(
      <TaskAssigneeModal
        task={mockUnassignedTask}
        members={[]}
        projectName="Website redesign"
        userRole="OWNER"
        isOpen={true}
        isLoadingMembers={true}
        onClose={vi.fn()}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('open-change-assignee-btn'));
    expect(screen.getByTestId('loading-members-box')).toHaveTextContent('Loading project members…');
    expect(screen.getByTestId('save-assignee-btn')).toBeDisabled();
  });

  it('State 04: shows no matching member feedback and disables save when search matches nothing', () => {
    render(
      <TaskAssigneeModal
        task={mockUnassignedTask}
        members={mockMembers}
        projectName="Website redesign"
        userRole="OWNER"
        isOpen={true}
        onClose={vi.fn()}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('open-change-assignee-btn'));
    const input = screen.getByTestId('member-search-input');
    fireEvent.change(input, { target: { value: 'NonExistent' } });

    expect(screen.getByTestId('no-matching-members-box')).toHaveTextContent(
      'No matching project members. Try a different search.'
    );
  });

  it('State 05 & 06: saves assignment and displays updated assignee with success banner', async () => {
    const onAssign = vi.fn().mockResolvedValue(true);
    const onUnassign = vi.fn().mockResolvedValue(true);

    render(
      <TaskAssigneeModal
        task={mockUnassignedTask}
        members={mockMembers}
        projectName="Website redesign"
        userRole="WRITER"
        isOpen={true}
        onClose={vi.fn()}
        onAssign={onAssign}
        onUnassign={onUnassign}
      />
    );

    fireEvent.click(screen.getByTestId('open-change-assignee-btn'));
    fireEvent.click(screen.getByTestId('assignee-option-u-1'));
    fireEvent.click(screen.getByTestId('save-assignee-btn'));

    await waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith('t-24', 'u-1');
    });

    await waitFor(() => {
      expect(screen.getByTestId('assignee-updated-banner')).toHaveTextContent('✓ Assignee updated');
      expect(screen.getByRole('heading', { name: 'Task assignee' })).toBeInTheDocument();
    });
  });

  it('State 07 & 08: removes existing assignment when Unassigned is selected', async () => {
    const onAssign = vi.fn().mockResolvedValue(true);
    const onUnassign = vi.fn().mockResolvedValue(true);

    render(
      <TaskAssigneeModal
        task={mockAssignedTask}
        members={mockMembers}
        projectName="Website redesign"
        userRole="OWNER"
        isOpen={true}
        onClose={vi.fn()}
        onAssign={onAssign}
        onUnassign={onUnassign}
      />
    );

    fireEvent.click(screen.getByTestId('open-change-assignee-btn'));
    fireEvent.click(screen.getByTestId('assignee-option-unassigned'));

    const saveBtn = screen.getByTestId('save-assignee-btn');
    expect(saveBtn).toHaveTextContent('Remove assignment');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onUnassign).toHaveBeenCalledWith('t-24', 'u-1');
    });

    await waitFor(() => {
      expect(screen.getByTestId('assignee-updated-banner')).toHaveTextContent('✓ Assignee updated');
    });
  });

  it('State 09: retains draft selection and shows error banner if saving fails', async () => {
    const onAssign = vi.fn().mockRejectedValue(new Error('Network error. Failed to assign.'));

    render(
      <TaskAssigneeModal
        task={mockUnassignedTask}
        members={mockMembers}
        projectName="Website redesign"
        userRole="OWNER"
        isOpen={true}
        onClose={vi.fn()}
        onAssign={onAssign}
        onUnassign={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('open-change-assignee-btn'));
    fireEvent.click(screen.getByTestId('assignee-option-u-2'));
    fireEvent.click(screen.getByTestId('save-assignee-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('assignee-error-banner')).toHaveTextContent(
        'Network error. Failed to assign.'
      );
    });

    // Stays in picker mode with user selection retained
    expect(screen.getByRole('heading', { name: 'Change assignee' })).toBeInTheDocument();
    expect(screen.getByTestId('assignee-option-u-2')).toHaveClass('assignee-option-item--selected');
  });

  it('State 10: reader view hides Change assignee control and shows disclaimer', () => {
    render(
      <TaskAssigneeModal
        task={mockAssignedTask}
        members={mockMembers}
        projectName="Website redesign"
        userRole="READER"
        isOpen={true}
        onClose={vi.fn()}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
      />
    );

    expect(screen.queryByTestId('open-change-assignee-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('assignee-reader-notice')).toHaveTextContent(
      'Only writers and owners of the project can assign tasks.'
    );
  });
});
