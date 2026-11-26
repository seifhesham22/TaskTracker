import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';
import { routes } from '../app/routes';
import {
  ColumnCategory,
  ProjectRole,
  TaskPriority,
  type ProjectWorkloadData,
} from '../domain/models';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('[US-29] View Open Tasks by Member (T1WOR-168)', () => {
  const projectId = '01a18766-48a1-7b2e-9c3f-5d6e7f809a1b';

  const mockProjectOwner = {
    id: projectId,
    key: 'WEB',
    name: 'Website redesign',
    role: 'OWNER',
    boards: [{ id: 'b-1', name: 'Sprint 3' }],
  };

  const mockProjectWriter = {
    id: projectId,
    key: 'WEB',
    name: 'Website redesign',
    role: 'WRITER',
    boards: [{ id: 'b-1', name: 'Sprint 3' }],
  };

  const sampleWorkloadData: ProjectWorkloadData = {
    averageOpenTasks: 3.67,
    totalOpenTasks: 14,
    members: [
      {
        userId: 'u-1',
        userName: 'Mina Joao',
        role: ProjectRole.Writer,
        openTaskCount: 8,
        openTasks: [
          {
            id: 't-1',
            readableId: 'TES-31',
            number: 31,
            boardId: 'b-1',
            title: 'Prepare launch checklist',
            status: ColumnCategory.ToDo,
            priority: TaskPriority.High,
          },
          {
            id: 't-2',
            readableId: 'TES-32',
            number: 32,
            boardId: 'b-1',
            title: 'Review permissions',
            status: ColumnCategory.InProgress,
            priority: TaskPriority.Medium,
          },
          {
            id: 't-3',
            readableId: 'TES-35',
            number: 35,
            boardId: 'b-1',
            title: 'Audit user roles',
            status: ColumnCategory.Backlog,
            priority: TaskPriority.Low,
          },
          {
            id: 't-4',
            readableId: 'TES-36',
            number: 36,
            boardId: 'b-1',
            title: 'Update design tokens',
            status: ColumnCategory.ToDo,
            priority: TaskPriority.Medium,
          },
          {
            id: 't-5',
            readableId: 'TES-37',
            number: 37,
            boardId: 'b-1',
            title: 'Verify responsive layout',
            status: ColumnCategory.InProgress,
            priority: TaskPriority.Critical,
          },
          {
            id: 't-6',
            readableId: 'TES-38',
            number: 38,
            boardId: 'b-1',
            title: 'Setup analytics hooks',
            status: ColumnCategory.Backlog,
            priority: null,
          },
          {
            id: 't-7',
            readableId: 'TES-39',
            number: 39,
            boardId: 'b-1',
            title: 'Draft release notes',
            status: ColumnCategory.ToDo,
            priority: TaskPriority.Low,
          },
          {
            id: 't-8',
            readableId: 'TES-40',
            number: 40,
            boardId: 'b-1',
            title: 'Refactor modal styles',
            status: ColumnCategory.InProgress,
            priority: TaskPriority.High,
          },
        ],
      },
      {
        userId: 'u-2',
        userName: 'Dombele Joao',
        role: ProjectRole.Writer,
        openTaskCount: 3,
        openTasks: [
          {
            id: 't-9',
            readableId: 'TES-41',
            number: 41,
            boardId: 'b-1',
            title: 'Fix Safari border radius',
            status: ColumnCategory.ToDo,
            priority: TaskPriority.Low,
          },
        ],
      },
      {
        userId: 'u-3',
        userName: 'Seif Hesham',
        role: ProjectRole.Owner,
        openTaskCount: 0,
        openTasks: [],
      },
    ],
    unassigned: [
      {
        id: 't-10',
        readableId: 'TES-33',
        number: 33,
        boardId: 'b-1',
        title: 'Update project guide',
        status: ColumnCategory.ToDo,
        priority: TaskPriority.Low,
      },
      {
        id: 't-11',
        readableId: 'TES-34',
        number: 34,
        boardId: 'b-1',
        title: 'Review handoff',
        status: ColumnCategory.ToDo,
        priority: TaskPriority.High,
      },
      {
        id: 't-12',
        readableId: 'TES-42',
        number: 42,
        boardId: 'b-1',
        title: 'Triage bug backlog',
        status: ColumnCategory.Backlog,
        priority: null,
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api.auth, 'me').mockResolvedValue({ id: 'u-3', email: 'seif@example.com' });
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectOwner]);
  });

  it('renders workload comparison with members sorted descending and visual bars (State 01)', async () => {
    vi.spyOn(api.workload, 'getWorkload').mockResolvedValue(sampleWorkloadData);

    renderAt(`/projects/${projectId}/workload`);

    // Verify breadcrumb and titles
    expect(await screen.findByText('Website redesign / View open tasks by member')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Team workload' })).toBeInTheDocument();
    expect(screen.getByText('Website redesign · Open tasks')).toBeInTheDocument();
    expect(screen.getByText('Counts exclude completed tasks.')).toBeInTheDocument();

    // Verify member cards in descending order
    const comparisonList = screen.getByTestId('workload-comparison-list');
    expect(comparisonList).toBeInTheDocument();

    expect(screen.getByText('Mina Joao')).toBeInTheDocument();
    expect(screen.getByTestId('workload-member-count-u-1')).toHaveTextContent('8 open');

    expect(screen.getByText('Dombele Joao')).toBeInTheDocument();
    expect(screen.getByTestId('workload-member-count-u-2')).toHaveTextContent('3 open');

    expect(screen.getByText('Seif Hesham')).toBeInTheDocument();
    expect(screen.getByTestId('workload-member-count-u-3')).toHaveTextContent('0 open');

    // Verify progress bars width
    const fill1 = screen.getByTestId('workload-bar-fill-u-1');
    expect(fill1).toHaveStyle({ width: '100%' }); // 8 / 8 = 100%

    const fill2 = screen.getByTestId('workload-bar-fill-u-2');
    expect(fill2).toHaveStyle({ width: '38%' }); // 3 / 8 = 37.5 -> 38%

    const fill3 = screen.getByTestId('workload-bar-fill-u-3');
    expect(fill3).toHaveStyle({ width: '0%' }); // 0 / 8 = 0%

    // Verify unassigned work card
    const unassignedCard = screen.getByTestId('workload-unassigned-card');
    expect(unassignedCard).toBeInTheDocument();
    expect(screen.getByText('Unassigned work')).toBeInTheDocument();
    expect(screen.getByText('3 open tasks · Separate from member totals')).toBeInTheDocument();

    // Verify action buttons
    expect(screen.getByTestId('workload-view-member-tasks-btn')).toBeInTheDocument();
    expect(screen.getByTestId('workload-view-unassigned-btn')).toBeInTheDocument();
  });

  it('drills down into member open tasks and supports pagination and back navigation (State 02)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.workload, 'getWorkload').mockResolvedValue(sampleWorkloadData);

    renderAt(`/projects/${projectId}/workload`);
    expect(await screen.findByText('Website redesign / View open tasks by member')).toBeInTheDocument();

    // Click on Mina Joao's card
    await user.click(screen.getByTestId('workload-member-card-u-1'));

    // Verify State 02 Drill-down view opens
    expect(screen.getByTestId('workload-drilldown-view')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Mina Joao’s open tasks' })).toBeInTheDocument();
    expect(screen.getByText('Website redesign · 8 open tasks')).toBeInTheDocument();

    // Check first page of open tasks (limit 5)
    expect(screen.getByText('Prepare launch checklist')).toBeInTheDocument();
    expect(screen.getByText('TES-31 · To do · High')).toBeInTheDocument();
    expect(screen.getByText('Review permissions')).toBeInTheDocument();
    expect(screen.getByText('TES-32 · In progress · Medium')).toBeInTheDocument();

    expect(screen.getByTestId('workload-showing-box')).toHaveTextContent('Showing 5 of 8 open tasks');

    // Click "Load more"
    const loadMoreBtn = screen.getByTestId('workload-load-more-btn');
    await user.click(loadMoreBtn);

    // Showing 8 of 8
    expect(screen.getByTestId('workload-showing-box')).toHaveTextContent('Showing 8 of 8 open tasks');
    expect(screen.getByText('Draft release notes')).toBeInTheDocument();
    expect(screen.getByText('Refactor modal styles')).toBeInTheDocument();
    expect(screen.queryByTestId('workload-load-more-btn')).not.toBeInTheDocument();

    // Click "Back to workload"
    await user.click(screen.getByTestId('workload-back-btn'));

    // Returned to State 01 comparison list
    expect(screen.getByTestId('workload-comparison-list')).toBeInTheDocument();
  });

  it('drills down into unassigned work and returns back to workload (State 03)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api.workload, 'getWorkload').mockResolvedValue(sampleWorkloadData);

    renderAt(`/projects/${projectId}/workload`);
    expect(await screen.findByText('Website redesign / View open tasks by member')).toBeInTheDocument();

    // Click "View unassigned work"
    await user.click(screen.getByTestId('workload-view-unassigned-btn'));

    // Drill down into unassigned work
    expect(screen.getByTestId('workload-drilldown-view')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Unassigned work' })).toBeInTheDocument();
    expect(screen.getByText('Website redesign · 3 open tasks')).toBeInTheDocument();

    expect(screen.getByText('Update project guide')).toBeInTheDocument();
    expect(screen.getByText('TES-33 · To do · Low')).toBeInTheDocument();
    expect(screen.getByText('Review handoff')).toBeInTheDocument();
    expect(screen.getByText('TES-34 · To do · High')).toBeInTheDocument();

    // Click Back to workload
    await user.click(screen.getByTestId('workload-back-btn'));
    expect(screen.getByTestId('workload-comparison-list')).toBeInTheDocument();
  });

  it('displays loading skeleton and announces loading while fetching (State 04)', async () => {
    let resolveQuery!: (value: ProjectWorkloadData) => void;
    vi.spyOn(api.workload, 'getWorkload').mockImplementation(
      () =>
        new Promise<ProjectWorkloadData>((resolve) => {
          resolveQuery = resolve;
        })
    );

    renderAt(`/projects/${projectId}/workload`);

    // Loading skeleton is visible
    expect(screen.getByTestId('workload-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('workload-loading-box')).toHaveTextContent(
      'Loading current assignments…'
    );
    expect(screen.getByRole('status', { name: 'Loading workload…' })).toBeInTheDocument();

    // Resolve query
    resolveQuery(sampleWorkloadData);
    expect(await screen.findByTestId('workload-comparison-list')).toBeInTheDocument();
  });

  it('displays no open work state when project has 0 open tasks (State 05)', async () => {
    vi.spyOn(api.workload, 'getWorkload').mockResolvedValue({
      averageOpenTasks: 0,
      totalOpenTasks: 0,
      members: [
        {
          userId: 'u-1',
          userName: 'Dombele Joao',
          role: ProjectRole.Writer,
          openTaskCount: 0,
          openTasks: [],
        },
        {
          userId: 'u-2',
          userName: 'Mina Joao',
          role: ProjectRole.Writer,
          openTaskCount: 0,
          openTasks: [],
        },
      ],
      unassigned: [],
    });

    renderAt(`/projects/${projectId}/workload`);

    expect(await screen.findByTestId('workload-zero-container')).toBeInTheDocument();
    expect(screen.getByTestId('workload-zero-box')).toHaveTextContent(
      'No open tasks in this project.'
    );
    expect(screen.getByTestId('workload-zero-member-u-1')).toHaveTextContent('0 open tasks');
    expect(screen.getByTestId('workload-zero-member-u-2')).toHaveTextContent('0 open tasks');
    expect(screen.getByTestId('workload-zero-back-btn')).toHaveTextContent('Back to project');
  });

  it('displays error box on failure and allows retry (State 06)', async () => {
    const user = userEvent.setup();
    const getWorkloadSpy = vi
      .spyOn(api.workload, 'getWorkload')
      .mockRejectedValueOnce(new ApiError('Couldn’t load workload. Try again.', 500, null))
      .mockResolvedValueOnce(sampleWorkloadData);

    renderAt(`/projects/${projectId}/workload`);

    // State 06 error box displayed
    expect(await screen.findByTestId('workload-error-box')).toHaveTextContent(
      'Couldn’t load workload. Try again.'
    );
    const retryBtn = screen.getByTestId('workload-retry-btn');
    expect(retryBtn).toHaveTextContent('Try again');

    // Click retry
    await user.click(retryBtn);

    expect(getWorkloadSpy).toHaveBeenCalledTimes(2);
    expect(await screen.findByTestId('workload-comparison-list')).toBeInTheDocument();
  });

  it('restricts access for Writer/Reader roles with clear messaging (State 07)', async () => {
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectWriter]);

    renderAt(`/projects/${projectId}/workload`);

    // State 07 access restricted view
    expect(await screen.findByTestId('workload-access-restricted')).toBeInTheDocument();
    expect(screen.getByText('Workload unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('Only authorized project roles can open this view.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('workload-restricted-back-btn')).toHaveTextContent(
      'Back to project'
    );
  });

  it('handles backend 403 AUTH_NOT_AUTHORIZED with State 07 restricted view', async () => {
    vi.spyOn(api.workload, 'getWorkload').mockRejectedValue(
      new ApiError('Only the owner of the project can see the workload.', 403, null)
    );

    renderAt(`/projects/${projectId}/workload`);

    expect(await screen.findByTestId('workload-access-restricted')).toBeInTheDocument();
    expect(screen.getByText('Workload unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('Only authorized project roles can open this view.')
    ).toBeInTheDocument();
  });
});
