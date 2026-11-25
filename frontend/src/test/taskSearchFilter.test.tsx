import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';
import { routes } from '../app/routes';
import { ColumnCategory, TaskPriority, type TaskItem } from '../domain/models';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('[US-36] Search and filter tasks on board acceptance tests', () => {
  const boardId = '01a18766-48b5-7fb8-a04c-13e1bf648def';

  const mockBoard = {
    id: boardId,
    projectId: 'p-1',
    projectName: 'Acme Project',
    name: 'Main Board',
    userRole: 'Owner',
    columns: [
      { id: 'c-todo', name: 'To do', category: ColumnCategory.ToDo, position: '1' },
      { id: 'c-prog', name: 'In progress', category: ColumnCategory.InProgress, position: '2' },
      { id: 'c-done', name: 'Done', category: ColumnCategory.Done, position: '3' },
    ],
    members: [
      { userId: 'u-1', userName: 'Alice Owner', role: 'Owner' },
      { userId: 'u-2', userName: 'Mina Joao', role: 'Writer' },
      { userId: 'u-3', userName: 'Bob Reader', role: 'Reader' },
    ],
  };

  const sampleTasks: TaskItem[] = [
    {
      id: 'task-1',
      readableId: 'ACM-1',
      number: 1,
      boardId,
      title: 'Design user interface layout',
      status: ColumnCategory.ToDo,
      columnId: 'c-todo',
      columnName: 'To do',
      priority: TaskPriority.High,
      assignees: [{ id: 'u-2', userName: 'Mina Joao' }],
      assigneeIds: ['u-2'],
      createdAt: '2026-11-20T10:00:00Z',
    },
    {
      id: 'task-2',
      readableId: 'ACM-2',
      number: 2,
      boardId,
      title: 'Implement search endpoint',
      status: ColumnCategory.InProgress,
      columnId: 'c-prog',
      columnName: 'In progress',
      priority: TaskPriority.Medium,
      assignees: [{ id: 'u-1', userName: 'Alice Owner' }],
      assigneeIds: ['u-1'],
      createdAt: '2026-11-20T11:00:00Z',
    },
    {
      id: 'task-3',
      readableId: 'ACM-3',
      number: 3,
      boardId,
      title: 'Fix unassigned bug',
      status: ColumnCategory.Done,
      columnId: 'c-done',
      columnName: 'Done',
      priority: null,
      assignees: [],
      assigneeIds: [],
      createdAt: '2026-11-20T12:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('State 01 / Shared task list: renders search input, filters trigger, and permitted task count', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue({
      board: mockBoard,
      tasks: sampleTasks,
    });

    renderAt('/tasks');

    expect(await screen.findByRole('heading', { level: 1, name: /main board/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search by title/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^filters$/i })).toBeInTheDocument();
    expect(screen.getByText(/3 tasks · permitted board tasks/i)).toBeInTheDocument();
  });

  it('State 02 & 03: opens filter modal, selects member assignee, status, priority, and applies filters', async () => {
    const getBoardSpy = vi.spyOn(api.board, 'getBoardWithTasks')
      .mockResolvedValueOnce({
        board: mockBoard,
        tasks: sampleTasks,
      })
      .mockResolvedValueOnce({
        board: mockBoard,
        tasks: [sampleTasks[0]],
      });

    const user = userEvent.setup();
    renderAt('/tasks');

    await screen.findByRole('heading', { level: 1, name: /main board/i });

    // Open filter modal
    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    expect(screen.getByTestId('filter-tasks-modal')).toBeInTheDocument();

    // Select Status
    await user.selectOptions(screen.getByTestId('filter-status-select'), ColumnCategory.ToDo);

    // Select Priority
    await user.selectOptions(screen.getByTestId('filter-priority-select'), TaskPriority.High);

    // Open Assignee Picker
    await user.click(screen.getByTestId('filter-assignee-trigger'));
    const assigneeModal = screen.getByTestId('assignee-select-modal');
    expect(assigneeModal).toBeInTheDocument();

    // Search inside assignee modal
    await user.type(screen.getByTestId('assignee-search-input'), 'Mina');
    expect(within(assigneeModal).getByText('Mina Joao')).toBeInTheDocument();

    // Select Mina Joao
    await user.click(screen.getByTestId('assignee-opt-u-2'));
    await user.click(screen.getByTestId('apply-assignee-btn'));

    // Modal closed, back to FilterTasksModal showing chosen assignee
    expect(screen.queryByTestId('assignee-select-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('filter-assignee-trigger')).toHaveTextContent('Mina Joao');

    // Apply filters
    await user.click(screen.getByTestId('apply-filters-btn'));

    // Verify GraphQL query options passed to BoardService
    await waitFor(() => {
      expect(getBoardSpy).toHaveBeenCalledWith(
        boardId,
        expect.objectContaining({
          where: {
            status: { eq: ColumnCategory.ToDo },
            priority: { eq: TaskPriority.High },
            assignees: { some: { userId: { eq: 'u-2' } } },
          },
        })
      );
    });

    // Check count display updates
    expect(await screen.findByText(/1 matching task/i)).toBeInTheDocument();
  });

  it('State 04: typing in title search triggers debounced query and shows matching count', async () => {
    const getBoardSpy = vi.spyOn(api.board, 'getBoardWithTasks')
      .mockResolvedValueOnce({
        board: mockBoard,
        tasks: sampleTasks,
      })
      .mockResolvedValue({
        board: mockBoard,
        tasks: [sampleTasks[0]],
      });

    const user = userEvent.setup();
    renderAt('/tasks');

    await screen.findByRole('heading', { level: 1, name: /main board/i });

    const searchInput = screen.getByTestId('board-search-input');
    await user.type(searchInput, 'interface');

    // Debounce wait
    await waitFor(
      () => {
        expect(getBoardSpy).toHaveBeenCalledWith(
          boardId,
          expect.objectContaining({
            search: 'interface',
          })
        );
      },
      { timeout: 1500 }
    );

    expect(await screen.findByText(/1 matching task/i)).toBeInTheDocument();
  });

  it('State 05: renders active filter chips, summary, allows chip removal and Clear all', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks')
      .mockResolvedValueOnce({
        board: mockBoard,
        tasks: sampleTasks,
      })
      .mockResolvedValue({
        board: mockBoard,
        tasks: [sampleTasks[0]],
      });

    const user = userEvent.setup();
    renderAt('/tasks');

    await screen.findByRole('heading', { level: 1, name: /main board/i });

    // Apply status filter
    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.selectOptions(screen.getByTestId('filter-status-select'), ColumnCategory.ToDo);
    await user.click(screen.getByTestId('apply-filters-btn'));

    // Active chip for To do is present
    expect(await screen.findByTestId('status-filter-chip')).toBeInTheDocument();
    expect(screen.getByText('To do ×')).toBeInTheDocument();

    // Summary text
    expect(screen.getByText(/1 filter/i)).toBeInTheDocument();

    // Remove status chip
    await user.click(screen.getByTestId('status-filter-chip'));

    // Status chip should be removed
    await waitFor(() => {
      expect(screen.queryByTestId('status-filter-chip')).not.toBeInTheDocument();
    });
  });

  it('State 06: displays feedback banner and Adjust filters button when no tasks match', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks')
      .mockResolvedValueOnce({
        board: mockBoard,
        tasks: sampleTasks,
      })
      .mockResolvedValueOnce({
        board: mockBoard,
        tasks: [],
      });

    const user = userEvent.setup();
    renderAt('/tasks');

    await screen.findByRole('heading', { level: 1, name: /main board/i });

    // Open filter modal and apply status Done
    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.selectOptions(screen.getByTestId('filter-status-select'), ColumnCategory.Done);
    await user.click(screen.getByTestId('apply-filters-btn'));

    // No matching results banner
    expect(await screen.findByTestId('no-matching-tasks-msg')).toBeInTheDocument();
    expect(screen.getByText(/no tasks match your search and filters\./i)).toBeInTheDocument();

    // Clicking Adjust filters reopens the modal
    await user.click(screen.getByRole('button', { name: /adjust filters/i }));
    expect(screen.getByTestId('filter-tasks-modal')).toBeInTheDocument();
  });

  it('State 08: displays error banner with retry button on filter error', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks')
      .mockResolvedValueOnce({
        board: mockBoard,
        tasks: sampleTasks,
      })
      .mockRejectedValueOnce(new ApiError('Failed to fetch tasks', 500, null));

    const user = userEvent.setup();
    renderAt('/tasks');

    await screen.findByRole('heading', { level: 1, name: /main board/i });

    // Apply priority filter
    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.selectOptions(screen.getByTestId('filter-priority-select'), TaskPriority.Critical);
    await user.click(screen.getByTestId('apply-filters-btn'));

    // Error banner displayed
    expect(await screen.findByTestId('filter-error-banner')).toBeInTheDocument();
    expect(screen.getByText(/failed to fetch tasks/i)).toBeInTheDocument();

    // Retry button exists and is clickable
    const retryBtn = screen.getByRole('button', { name: /try again/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it('State 09: clearing filters restores full permitted task list', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks')
      .mockResolvedValueOnce({
        board: mockBoard,
        tasks: sampleTasks,
      })
      .mockResolvedValueOnce({
        board: mockBoard,
        tasks: [sampleTasks[0]],
      })
      .mockResolvedValueOnce({
        board: mockBoard,
        tasks: sampleTasks,
      });

    const user = userEvent.setup();
    renderAt('/tasks');

    await screen.findByRole('heading', { level: 1, name: /main board/i });

    // Apply filter
    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.selectOptions(screen.getByTestId('filter-status-select'), ColumnCategory.ToDo);
    await user.click(screen.getByTestId('apply-filters-btn'));

    expect(await screen.findByTestId('clear-all-filters-btn')).toBeInTheDocument();

    // Click Clear all
    await user.click(screen.getByTestId('clear-all-filters-btn'));

    // Should call getBoardWithTasks with empty options and restore full count
    await waitFor(() => {
      expect(screen.queryByTestId('clear-all-filters-btn')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/3 tasks · permitted board tasks/i)).toBeInTheDocument();
  });
});
