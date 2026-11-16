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

describe('[US-23] Project Backlog Acceptance Tests', () => {
  const projectId = '01a18766-48a1-7b2e-9c3f-5d6e7f809a1b';

  const mockProject = {
    id: projectId,
    key: 'TES',
    name: 'Test Project',
    role: 'OWNER',
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
    {
      id: 'task-4',
      readableId: 'TES-34',
      number: 34,
      boardId: 'b-1',
      title: 'Explore notification preferences',
      status: ColumnCategory.Backlog,
      column: { id: 'col-3', name: 'Backlog', category: ColumnCategory.Backlog },
      priority: null,
      assignees: [],
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api.auth, 'me').mockResolvedValue({ id: 'u-1', email: 'user@example.com' });
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProject]);
  });

  it('renders backlog items in one unified ordered list preserving backend order (State 01)', async () => {
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: sampleItems,
      totalCount: 4,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderAt(`/projects/${projectId}/backlog`);

    // Verify Header and Breadcrumbs
    expect(await screen.findByRole('heading', { level: 1, name: 'Project backlog' })).toBeInTheDocument();
    expect(screen.getByText('Test Project / Project backlog')).toBeInTheDocument();
    expect(screen.getByText('TEST PROJECT')).toBeInTheDocument();
    expect(screen.getByText('Upcoming work, in one ordered list.')).toBeInTheDocument();
    expect(screen.getByText('4 items · Ordered by backlog position')).toBeInTheDocument();

    // Verify ordering matches backend response with position numbers
    const itemsList = screen.getByTestId('backlog-items-list');
    expect(itemsList).toBeInTheDocument();

    expect(screen.getByText('1 · TES-31')).toBeInTheDocument();
    expect(screen.getByText('Prepare the launch checklist')).toBeInTheDocument();
    expect(screen.getByText(/To do · High/i)).toBeInTheDocument();

    expect(screen.getByText('2 · TES-32')).toBeInTheDocument();
    expect(screen.getByText('Review project permissions')).toBeInTheDocument();
    expect(screen.getByText(/In progress · Critical/i)).toBeInTheDocument();

    expect(screen.getByText('3 · TES-33')).toBeInTheDocument();
    expect(screen.getByText('Update the project guide')).toBeInTheDocument();
    expect(screen.getByText(/Backlog · Low/i)).toBeInTheDocument();

    expect(screen.getByText('4 · TES-34')).toBeInTheDocument();
    expect(screen.getByText('Explore notification preferences')).toBeInTheDocument();
    expect(screen.getByText(/Backlog · No priority/i)).toBeInTheDocument();
  });

  it('displays loading skeleton and announces loading while fetching (State 02)', async () => {
    let resolveQuery!: (value: unknown) => void;
    const queryPromise = new Promise((resolve) => {
      resolveQuery = resolve;
    });

    vi.spyOn(api.backlog, 'getBacklog').mockImplementation(
      () => queryPromise as ReturnType<typeof api.backlog.getBacklog>
    );

    renderAt(`/projects/${projectId}/backlog`);

    // While loading, skeleton and text are visible
    expect(screen.getByLabelText('Loading backlog…')).toBeInTheDocument();
    expect(screen.getByText('Loading backlog…')).toBeInTheDocument();

    // Resolve query
    resolveQuery({
      items: sampleItems,
      totalCount: 4,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    expect(await screen.findByText('Prepare the launch checklist')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading backlog…')).not.toBeInTheDocument();
  });

  it('displays empty state with "Back to project" button when project has no backlog items (State 03)', async () => {
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderAt(`/projects/${projectId}/backlog`);

    expect(await screen.findByRole('heading', { level: 2, name: 'No backlog items yet' })).toBeInTheDocument();
    expect(screen.getByText('Tasks added to this project’s backlog will appear here.')).toBeInTheDocument();
    const backBtn = screen.getByTestId('backlog-back-btn');
    expect(backBtn).toHaveTextContent('Back to project');
  });

  it('displays load error banner with "Try again" button and allows retry (State 04)', async () => {
    const getBacklogSpy = vi
      .spyOn(api.backlog, 'getBacklog')
      .mockRejectedValueOnce(new ApiError('Network connection failed.', 500, null))
      .mockResolvedValueOnce({
        items: [sampleItems[0]],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });

    renderAt(`/projects/${projectId}/backlog`);

    expect(await screen.findByTestId('backlog-error-banner')).toBeInTheDocument();
    expect(screen.getByText('Couldn’t load the backlog')).toBeInTheDocument();
    expect(screen.getByText('Try again to load the project’s upcoming work.')).toBeInTheDocument();

    // Retry
    const retryBtn = screen.getByTestId('backlog-retry-btn');
    fireEvent.click(retryBtn);

    expect(await screen.findByText('Prepare the launch checklist')).toBeInTheDocument();
    expect(screen.queryByTestId('backlog-error-banner')).not.toBeInTheDocument();
    expect(getBacklogSpy).toHaveBeenCalledTimes(2);
  });

  it('searches tasks by title and sends search variable to backend', async () => {
    const user = userEvent.setup();
    const getBacklogSpy = vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: [sampleItems[0]],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderAt(`/projects/${projectId}/backlog`);

    const searchInput = await screen.findByPlaceholderText('Search tasks by title…');
    await user.type(searchInput, 'launch');

    await waitFor(() => {
      expect(getBacklogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          search: 'launch',
        })
      );
    });
  });

  it('filters tasks by status and priority separately', async () => {
    const user = userEvent.setup();
    const getBacklogSpy = vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: [sampleItems[0]],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderAt(`/projects/${projectId}/backlog`);

    // 1. Filter by status: To do
    const statusSelect = await screen.findByLabelText('Filter by status');
    await user.selectOptions(statusSelect, ColumnCategory.ToDo);

    await waitFor(() => {
      expect(getBacklogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { eq: ColumnCategory.ToDo } },
        })
      );
    });

    // 2. Filter by priority: High
    const prioritySelect = screen.getByLabelText('Filter by priority');
    await user.selectOptions(prioritySelect, TaskPriority.High);

    await waitFor(() => {
      expect(getBacklogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { eq: ColumnCategory.ToDo },
            priority: { eq: TaskPriority.High },
          },
        })
      );
    });
  });

  it('applies search and multiple filters simultaneously', async () => {
    const user = userEvent.setup();
    const getBacklogSpy = vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue({
      items: [sampleItems[1]],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderAt(`/projects/${projectId}/backlog`);

    const searchInput = await screen.findByPlaceholderText('Search tasks by title…');
    await user.type(searchInput, 'permissions');

    const statusSelect = screen.getByLabelText('Filter by status');
    await user.selectOptions(statusSelect, ColumnCategory.InProgress);

    const prioritySelect = screen.getByLabelText('Filter by priority');
    await user.selectOptions(prioritySelect, TaskPriority.Critical);

    await waitFor(() => {
      expect(getBacklogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          search: 'permissions',
          where: {
            status: { eq: ColumnCategory.InProgress },
            priority: { eq: TaskPriority.Critical },
          },
        })
      );
    });
  });

  it('navigates between backlog pages with pagination controls', async () => {
    const page1Items = [sampleItems[0], sampleItems[1]];
    const page2Items = [sampleItems[2], sampleItems[3]];

    const getBacklogSpy = vi.spyOn(api.backlog, 'getBacklog').mockImplementation(async (input) => {
      if (input.page === 2) {
        return {
          items: page2Items,
          totalCount: 4,
          page: 2,
          pageSize: 2,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true,
        };
      }
      return {
        items: page1Items,
        totalCount: 4,
        page: 1,
        pageSize: 2,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      };
    });

    renderAt(`/projects/${projectId}/backlog`);

    // Page 1
    expect(await screen.findByText('1 · TES-31')).toBeInTheDocument();
    expect(screen.getByText('2 · TES-32')).toBeInTheDocument();
    expect(screen.getByTestId('backlog-pagination-info')).toHaveTextContent('Page 1 of 2 · 4 items');

    const prevBtn = screen.getByTestId('backlog-prev-page-btn');
    const nextBtn = screen.getByTestId('backlog-next-page-btn');
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Click Next to navigate to Page 2
    fireEvent.click(nextBtn);

    expect(await screen.findByText('3 · TES-33')).toBeInTheDocument();
    expect(screen.getByText('4 · TES-34')).toBeInTheDocument();
    expect(screen.getByTestId('backlog-pagination-info')).toHaveTextContent('Page 2 of 2 · 4 items');
    expect(screen.getByTestId('backlog-prev-page-btn')).toBeEnabled();
    expect(screen.getByTestId('backlog-next-page-btn')).toBeDisabled();

    expect(getBacklogSpy).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('resets pagination to page 1 whenever the search term or filters change', async () => {
    const getBacklogSpy = vi.spyOn(api.backlog, 'getBacklog').mockImplementation(async (input) => {
      const page = input.page ?? 1;
      return {
        items: page === 2 ? [sampleItems[2]] : [sampleItems[0]],
        totalCount: 20,
        page,
        pageSize: 1,
        totalPages: 20,
        hasNextPage: page < 20,
        hasPreviousPage: page > 1,
      };
    });

    renderAt(`/projects/${projectId}/backlog`);

    // Navigate to page 2
    const nextBtn = await screen.findByTestId('backlog-next-page-btn');
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByTestId('backlog-pagination-info')).toHaveTextContent('Page 2 of 20 · 20 items');
    });

    // Change search term
    const searchInput = screen.getByPlaceholderText('Search tasks by title…');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Page must reset to 1
    await waitFor(
      () => {
        expect(getBacklogSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'test',
            page: 1,
          })
        );
      },
      { timeout: 2000 }
    );
  });
});
