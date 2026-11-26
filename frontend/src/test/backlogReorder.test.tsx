import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';
import { routes } from '../app/routes';
import { ColumnCategory, TaskPriority, type BacklogItem } from '../domain/models';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('[US-24] Prioritize and Reorder Backlog Items (T1WOR-163)', () => {
  const projectId = '01a18766-48a1-7b2e-9c3f-5d6e7f809a1b';

  const mockProjectOwner = {
    id: projectId,
    key: 'TES',
    name: 'Test Project',
    role: 'OWNER',
    boards: [{ id: 'b-1', name: 'Test Board' }],
  };

  const mockProjectReader = {
    id: projectId,
    key: 'TES',
    name: 'Test Project',
    role: 'READER',
    boards: [{ id: 'b-1', name: 'Test Board' }],
  };

  const sampleItems: BacklogItem[] = [
    {
      id: 'task-1',
      readableId: 'TES-31',
      number: 31,
      boardId: 'b-1',
      title: 'Prepare the launch checklist',
      status: ColumnCategory.ToDo,
      column: { id: 'col-1', name: 'To do', category: ColumnCategory.ToDo },
      priority: TaskPriority.High,
      assignees: [],
    },
    {
      id: 'task-2',
      readableId: 'TES-32',
      number: 32,
      boardId: 'b-1',
      title: 'Review project permissions',
      status: ColumnCategory.InProgress,
      column: { id: 'col-2', name: 'In progress', category: ColumnCategory.InProgress },
      priority: TaskPriority.Critical,
      assignees: [],
    },
    {
      id: 'task-3',
      readableId: 'TES-33',
      number: 33,
      boardId: 'b-1',
      title: 'Update the project guide',
      status: ColumnCategory.Backlog,
      column: { id: 'col-3', name: 'Backlog', category: ColumnCategory.Backlog },
      priority: TaskPriority.Low,
      assignees: [],
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api.auth, 'me').mockResolvedValue({ id: 'u-1', email: 'user@example.com' });
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectOwner]);
  });

  it('renders ordered backlog with drag handles and item actions for Owner/Writer (State 01)', async () => {
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: sampleItems,
      totalCount: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderAt(`/projects/${projectId}/backlog`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    // Verify position indices and items
    expect(screen.getByText('1 · TES-31')).toBeInTheDocument();
    expect(screen.getByText('2 · TES-32')).toBeInTheDocument();
    expect(screen.getByText('3 · TES-33')).toBeInTheDocument();

    // Verify drag handles are present and enabled
    expect(screen.getByTestId('backlog-drag-handle-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('backlog-drag-handle-task-2')).toBeInTheDocument();
    expect(screen.getByTestId('backlog-drag-handle-task-3')).toBeInTheDocument();

    // Verify item action triggers are present
    expect(screen.getByTestId('backlog-item-actions-btn-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('backlog-item-actions-btn-task-2')).toBeInTheDocument();
    expect(screen.getByTestId('backlog-item-actions-btn-task-3')).toBeInTheDocument();
  });

  it('opens accessible item actions modal and handles move down (State 02)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: sampleItems,
      totalCount: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    const rankSpy = vi.spyOn(api.backlog, 'rankTask').mockResolvedValue({
      id: 'task-1',
      readableId: 'TES-31',
    });

    renderAt(`/projects/${projectId}/backlog`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    // Click item actions on task-1
    await user.click(screen.getByTestId('backlog-item-actions-btn-task-1'));

    // Modal opens
    expect(screen.getByTestId('backlog-item-actions-modal')).toBeInTheDocument();
    expect(screen.getByText('Item actions')).toBeInTheDocument();
    expect(screen.getByText('TES-31 · Current position 1 of 3')).toBeInTheDocument();

    // Move up should be disabled at position 1
    expect(screen.getByTestId('backlog-action-move-up')).toBeDisabled();
    // Move down should be enabled
    const moveDownBtn = screen.getByTestId('backlog-action-move-down');
    expect(moveDownBtn).toBeEnabled();

    // Click Move down
    await user.click(moveDownBtn);

    // Modal closes and rankTask is called with taskId='task-1' after 'task-2'
    await waitFor(() => {
      expect(rankSpy).toHaveBeenCalledWith({
        taskId: 'task-1',
        afterTaskId: 'task-2',
      });
    });

    // Success banner is displayed (State 06)
    expect(screen.getByTestId('backlog-order-saved-banner')).toHaveTextContent(
      'Order saved for all project members'
    );
  });

  it('handles move up from position 2 to position 1', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: sampleItems,
      totalCount: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    const rankSpy = vi.spyOn(api.backlog, 'rankTask').mockResolvedValue({
      id: 'task-2',
      readableId: 'TES-32',
    });

    renderAt(`/projects/${projectId}/backlog`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    // Click item actions on task-2 (position 2)
    await user.click(screen.getByTestId('backlog-item-actions-btn-task-2'));

    const moveUpBtn = screen.getByTestId('backlog-action-move-up');
    expect(moveUpBtn).toBeEnabled();
    await user.click(moveUpBtn);

    // Moves to top (position 1), so afterTaskId is null
    await waitFor(() => {
      expect(rankSpy).toHaveBeenCalledWith({
        taskId: 'task-2',
        afterTaskId: undefined,
      });
    });
  });

  it('moves item to a global position using the Move to Position modal (State 03)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: sampleItems,
      totalCount: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    const rankSpy = vi.spyOn(api.backlog, 'rankTask').mockResolvedValue({
      id: 'task-1',
      readableId: 'TES-31',
    });

    renderAt(`/projects/${projectId}/backlog`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    // Open item actions on task-1
    await user.click(screen.getByTestId('backlog-item-actions-btn-task-1'));
    // Click "Move to position…"
    await user.click(screen.getByTestId('backlog-action-move-position'));

    // Move to position modal opens
    expect(screen.getByTestId('backlog-move-position-modal')).toBeInTheDocument();
    expect(screen.getByText('Move to a global position')).toBeInTheDocument();
    expect(screen.getByText('Enter a position from 1 to 3 for TES-31.')).toBeInTheDocument();

    const input = screen.getByTestId('backlog-position-input');
    await user.clear(input);
    await user.type(input, '3');

    // Preview shows moving after TES-33
    expect(screen.getByTestId('backlog-position-preview')).toHaveTextContent(
      'Move this item after TES-33.'
    );

    // Submit move
    const submitBtn = screen.getByTestId('backlog-move-submit-btn');
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    // Should call rankTask with afterTaskId = task-3 (the last item)
    await waitFor(() => {
      expect(rankSpy).toHaveBeenCalledWith({
        taskId: 'task-1',
        afterTaskId: 'task-3',
      });
    });

    expect(screen.getByTestId('backlog-order-saved-banner')).toBeInTheDocument();
  });

  it('updates item priority using the priority modal and displays banner (State 04 & 07)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: sampleItems,
      totalCount: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    const prioritySpy = vi.spyOn(api.backlog, 'updateTaskPriority').mockResolvedValue({
      id: 'task-1',
      readableId: 'TES-31',
      priority: TaskPriority.Critical,
    });

    renderAt(`/projects/${projectId}/backlog`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    // Open item actions on task-1
    await user.click(screen.getByTestId('backlog-item-actions-btn-task-1'));
    // Click "Change priority"
    await user.click(screen.getByTestId('backlog-action-change-priority'));

    // Priority modal opens
    expect(screen.getByTestId('backlog-priority-modal')).toBeInTheDocument();
    expect(screen.getByText('Change item priority')).toBeInTheDocument();
    expect(screen.getByText('Set priority for TES-31.')).toBeInTheDocument();

    // Select Critical
    await user.click(screen.getByTestId('backlog-priority-option-CRITICAL'));

    // Submit
    const submitBtn = screen.getByTestId('backlog-priority-submit-btn');
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    // Verify API called
    await waitFor(() => {
      expect(prioritySpy).toHaveBeenCalledWith('task-1', TaskPriority.Critical);
    });

    // Success banner is shown
    expect(screen.getByTestId('backlog-priority-saved-banner')).toHaveTextContent(
      'Priority updated to Critical'
    );
  });

  it('rolls back optimistic move when rankTask fails and displays error alert (State 08)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: sampleItems,
      totalCount: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.spyOn(api.backlog, 'rankTask').mockRejectedValue(
      new ApiError('Only writers and owners of the project can change the backlog order.', 403, null)
    );

    renderAt(`/projects/${projectId}/backlog`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    // Move task 1 down
    await user.click(screen.getByTestId('backlog-item-actions-btn-task-1'));
    await user.click(screen.getByTestId('backlog-action-move-down'));

    // Error banner appears with rollback notification
    expect(await screen.findByTestId('backlog-reorder-error-banner')).toBeInTheDocument();
    expect(screen.getByTestId('backlog-reorder-error-banner')).toHaveTextContent(
      'Only writers and owners of the project can change the backlog order.'
    );

    // Rollback confirmed: task 1 is back at position 1
    expect(screen.getByText('1 · TES-31')).toBeInTheDocument();
  });

  it('rolls back optimistic priority change when updateTaskPriority fails (State 09)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: sampleItems,
      totalCount: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    vi.spyOn(api.backlog, 'updateTaskPriority').mockRejectedValue(
      new ApiError('Network connection lost.', 500, null)
    );

    renderAt(`/projects/${projectId}/backlog`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    // Open change priority
    await user.click(screen.getByTestId('backlog-item-actions-btn-task-1'));
    await user.click(screen.getByTestId('backlog-action-change-priority'));
    await user.click(screen.getByTestId('backlog-priority-option-LOW'));
    await user.click(screen.getByTestId('backlog-priority-submit-btn'));

    // Error banner is displayed
    expect(await screen.findByTestId('backlog-priority-error-banner')).toBeInTheDocument();
    expect(screen.getByTestId('backlog-priority-error-banner')).toHaveTextContent(
      'Network connection lost.'
    );
  });

  it('hides drag handles and item actions for Reader role (State 10)', async () => {
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectReader]);
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: sampleItems,
      totalCount: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderAt(`/projects/${projectId}/backlog`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    // Reader view: no drag handles and no item actions buttons
    expect(screen.queryByTestId('backlog-drag-handle-task-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('backlog-item-actions-btn-task-1')).not.toBeInTheDocument();
  });

  it('disables reordering when filter is active and shows informative notice (State 11)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: [sampleItems[0]],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderAt(`/projects/${projectId}/backlog`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    // Change status filter
    const statusSelect = screen.getByLabelText('Filter by status');
    fireEvent.change(statusSelect, { target: { value: ColumnCategory.ToDo } });

    // Informative notice is displayed
    expect(await screen.findByTestId('backlog-filter-reorder-notice')).toHaveTextContent(
      'Reordering is disabled while filters or search are active. Clear filters to reorder tasks.'
    );

    // Drag handle is disabled
    const dragHandle = screen.getByTestId('backlog-drag-handle-task-1');
    expect(dragHandle).toHaveAttribute('aria-disabled', 'true');

    // Open item actions
    await user.click(screen.getByTestId('backlog-item-actions-btn-task-1'));

    // Move options are disabled with filter notice
    expect(screen.getByTestId('backlog-actions-filter-notice')).toBeInTheDocument();
    expect(screen.getByTestId('backlog-action-move-up')).toBeDisabled();
    expect(screen.getByTestId('backlog-action-move-down')).toBeDisabled();
    expect(screen.getByTestId('backlog-action-move-position')).toBeDisabled();
    // But change priority remains enabled!
    expect(screen.getByTestId('backlog-action-change-priority')).toBeEnabled();
  });

  it('supports HTML5 drag and drop reordering', async () => {
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: sampleItems,
      totalCount: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    const rankSpy = vi.spyOn(api.backlog, 'rankTask').mockResolvedValue({
      id: 'task-1',
      readableId: 'TES-31',
    });

    renderAt(`/projects/${projectId}/backlog`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    const sourceCard = screen.getByTestId('backlog-item-task-1');
    const targetCard = screen.getByTestId('backlog-item-task-3');

    // Simulate dragstart and drop
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(key: string, val: string) {
        this.data[key] = val;
      },
      getData(key: string) {
        return this.data[key] || '';
      },
      dropEffect: 'none',
      effectAllowed: 'all',
    };

    fireEvent.dragStart(sourceCard, { dataTransfer });
    fireEvent.dragOver(targetCard, { dataTransfer });
    fireEvent.drop(targetCard, { dataTransfer });

    await waitFor(() => {
      expect(rankSpy).toHaveBeenCalledWith({
        taskId: 'task-1',
        afterTaskId: 'task-3',
      });
    });
  });

  it('supports moving beyond the loaded page (e.g. position 1 to 25 with 26 tasks) and persists order', async () => {
    const user = userEvent.setup();

    // Create 26 mock tasks
    const all26Tasks: BacklogItem[] = Array.from({ length: 26 }, (_, idx) => ({
      id: `task-${idx + 1}`,
      readableId: `TES-${idx + 1}`,
      number: idx + 1,
      boardId: 'b-1',
      title: `Backlog Task ${idx + 1}`,
      status: ColumnCategory.Backlog,
      column: { id: 'col-backlog', name: 'Backlog', category: ColumnCategory.Backlog },
      priority: TaskPriority.Medium,
      assignees: [],
    }));

    // Page 1 initial response (20 items)
    const page1Initial = {
      items: all26Tasks.slice(0, 20),
      totalCount: 26,
      page: 1,
      pageSize: 20,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    };

    // Single item query for target predecessor at position 25
    const position25SingleItem = {
      items: [all26Tasks[24]], // task-25
      totalCount: 26,
      page: 25,
      pageSize: 1,
      totalPages: 26,
      hasNextPage: true,
      hasPreviousPage: true,
    };

    // Page 1 response after task-1 is moved to position 25 (task-2 through task-21)
    const page1AfterMove = {
      items: all26Tasks.slice(1, 21),
      totalCount: 26,
      page: 1,
      pageSize: 20,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    };

    const getBacklogSpy = vi.spyOn(api.backlog, 'getBacklog').mockImplementation(async (input) => {
      if (input.page === 25 && input.pageSize === 1) {
        return position25SingleItem;
      }
      if (input.page === 1) {
        return page1Initial;
      }
      return page1Initial;
    });

    const rankSpy = vi.spyOn(api.backlog, 'rankTask').mockImplementation(async () => {
      // Once ranked, subsequent page 1 queries return page1AfterMove
      getBacklogSpy.mockResolvedValue(page1AfterMove);
      return { id: 'task-1', readableId: 'TES-1' };
    });

    renderAt(`/projects/${projectId}/backlog`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();

    // Verify task-1 is initially at position 1
    expect(screen.getByText('1 · TES-1')).toBeInTheDocument();

    // Open item actions on task-1
    await user.click(screen.getByTestId('backlog-item-actions-btn-task-1'));
    // Click "Move to position…"
    await user.click(screen.getByTestId('backlog-action-move-position'));

    // Move to position modal opens with allowed range 1 to 26
    expect(screen.getByTestId('backlog-move-position-modal')).toBeInTheDocument();
    expect(screen.getByText('Enter a position from 1 to 26 for TES-1.')).toBeInTheDocument();

    const input = screen.getByTestId('backlog-position-input');
    await user.clear(input);
    await user.type(input, '25');

    // Submit move to position 25
    const submitBtn = screen.getByTestId('backlog-move-submit-btn');
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    // Verify it fetched the target task at position 25
    await waitFor(() => {
      expect(getBacklogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 25,
          pageSize: 1,
        })
      );
    });

    // Verify rankTask was called placing task-1 after task-25
    await waitFor(() => {
      expect(rankSpy).toHaveBeenCalledWith({
        taskId: 'task-1',
        afterTaskId: 'task-25',
      });
    });

    // Verify order saved banner is displayed
    expect(await screen.findByTestId('backlog-order-saved-banner')).toBeInTheDocument();

    // Verify task-1 has moved off page 1 (now at position 25 on page 2), and task-2 is now at position 1
    expect(screen.getByText('1 · TES-2')).toBeInTheDocument();
    expect(screen.queryByText('1 · TES-1')).not.toBeInTheDocument();
  });
});
