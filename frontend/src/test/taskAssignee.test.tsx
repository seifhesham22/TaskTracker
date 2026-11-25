import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { routes } from '../app/routes';
import { ColumnCategory, type TaskItem, TaskPriority } from '../domain/models';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('US-12 Assign or unassign task members acceptance tests', () => {
  const mockBoardData = {
    board: {
      id: '01a18766-48b5-7fb8-a04c-13e1bf648def',
      projectId: 'p-1',
      projectName: 'Test Project',
      name: 'Test Board',
      userRole: 'Owner',
      columns: [
        { id: 'c-todo', name: 'To do', category: ColumnCategory.ToDo, position: 'l' },
      ],
      members: [
        { userId: 'u-1', userName: 'alice@example.com', role: 'Owner' },
        { userId: 'u-2', userName: 'bob@example.com', role: 'Writer' },
        { userId: 'u-3', userName: 'carol@example.com', role: 'Reader' },
      ],
    },
    tasks: [
      {
        id: 't-1',
        readableId: 'TES-1',
        number: 1,
        boardId: '01a18766-48b5-7fb8-a04c-13e1bf648def',
        title: 'Task for Assignment',
        description: 'Test description',
        status: ColumnCategory.ToDo,
        columnId: 'c-todo',
        columnName: 'To do',
        priority: TaskPriority.Medium,
        assignees: [],
        assigneeIds: [],
        createdAt: '2026-11-01T00:00:00Z',
      } as TaskItem,
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows Owner to assign a project member to an unassigned task from Task Details modal', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardData);
    const assignSpy = vi.spyOn(api.board, 'assignTask').mockResolvedValue(mockBoardData.tasks[0]);

    renderAt('/tasks');

    // Open task details
    const taskCard = await screen.findByTestId('task-card-t-1');
    fireEvent.click(taskCard);

    // Verify task details modal opened
    expect(await screen.findByTestId('parent-task-details-modal')).toBeInTheDocument();

    // Click "Change assignee" button
    const changeAssigneeBtn = screen.getByTestId('task-details-change-assignee-btn');
    fireEvent.click(changeAssigneeBtn);

    // Verify TaskAssigneeModal is open
    expect(await screen.findByTestId('task-assignee-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /change assignee/i })).toBeInTheDocument();

    // Select Bob (u-2)
    const bobRadio = screen.getByTestId('assignee-option-u-2');
    fireEvent.click(bobRadio);

    // Click "Save changes"
    const saveBtn = screen.getByTestId('save-assignee-btn');
    fireEvent.click(saveBtn);

    // Verify API called with taskId and userId
    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith({
        taskId: 't-1',
        userId: 'u-2',
      });
    });

    // Success banner is visible
    expect(await screen.findByTestId('assignee-updated-banner')).toHaveTextContent(/assignee updated/i);
  });

  it('allows Writer to unassign a task when Unassigned option is selected', async () => {
    const assignedBoardData = {
      ...mockBoardData,
      board: {
        ...mockBoardData.board,
        userRole: 'Writer',
      },
      tasks: [
        {
          ...mockBoardData.tasks[0],
          assignees: [{ id: 'u-2', userName: 'bob@example.com' }],
          assigneeIds: ['u-2'],
        },
      ],
    };

    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(assignedBoardData);
    const unassignSpy = vi.spyOn(api.board, 'unassignTask').mockResolvedValue(mockBoardData.tasks[0]);

    renderAt('/tasks');

    // Open task details
    const taskCard = await screen.findByTestId('task-card-t-1');
    fireEvent.click(taskCard);

    // Click "Change assignee"
    const changeAssigneeBtn = await screen.findByTestId('task-details-change-assignee-btn');
    fireEvent.click(changeAssigneeBtn);

    // Modal opens
    expect(await screen.findByTestId('task-assignee-modal')).toBeInTheDocument();

    // Select "— Unassigned"
    const unassignRadio = screen.getByTestId('assignee-option-unassigned');
    fireEvent.click(unassignRadio);

    // Save button label should reflect "Remove assignment"
    const saveBtn = screen.getByTestId('save-assignee-btn');
    expect(saveBtn).toHaveTextContent(/remove assignment/i);
    fireEvent.click(saveBtn);

    // Verify API called with taskId and prior userId
    await waitFor(() => {
      expect(unassignSpy).toHaveBeenCalledWith({
        taskId: 't-1',
        userId: 'u-2',
      });
    });

    expect(await screen.findByTestId('assignee-updated-banner')).toHaveTextContent(/assignee updated/i);
  });

  it('shows error banner and retains selection if assignment fails on server', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardData);
    vi.spyOn(api.board, 'assignTask').mockRejectedValue(new Error("Couldn't save assignment. Try again."));

    renderAt('/tasks');

    const taskCard = await screen.findByTestId('task-card-t-1');
    fireEvent.click(taskCard);

    const changeAssigneeBtn = await screen.findByTestId('task-details-change-assignee-btn');
    fireEvent.click(changeAssigneeBtn);

    const aliceRadio = screen.getByTestId('assignee-option-u-1');
    fireEvent.click(aliceRadio);

    const saveBtn = screen.getByTestId('save-assignee-btn');
    fireEvent.click(saveBtn);

    // Error banner displayed
    expect(await screen.findByTestId('assignee-error-banner')).toHaveTextContent(
      "Couldn't save assignment. Try again."
    );

    // Alice option is still selected
    expect(aliceRadio).toBeChecked();
  });

  it('restricts Readers from assigning tasks by showing disclaimer and hiding change buttons', async () => {
    const readerBoardData = {
      ...mockBoardData,
      board: {
        ...mockBoardData.board,
        userRole: 'Reader',
      },
    };

    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(readerBoardData);

    renderAt('/tasks');

    const taskCard = await screen.findByTestId('task-card-t-1');
    fireEvent.click(taskCard);

    // In task details modal, change assignee button is not shown for Readers
    expect(await screen.findByTestId('parent-task-details-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('task-details-change-assignee-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manage-assignee-button')).not.toBeInTheDocument();
  });

  it('allows assigning from EditTaskModal for permitted users', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardData);

    renderAt('/tasks');

    const taskCard = await screen.findByTestId('task-card-t-1');
    fireEvent.click(taskCard);

    // Open Edit modal
    const editBtn = await screen.findByTestId('open-edit-task-btn');
    fireEvent.click(editBtn);

    expect(await screen.findByTestId('edit-task-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('edit-task-assignee-name')).toHaveTextContent('Unassigned');

    const changeBtn = screen.getByTestId('edit-task-change-assignee-btn');
    fireEvent.click(changeBtn);

    // TaskAssigneeModal is displayed
    expect(await screen.findByTestId('task-assignee-modal')).toBeInTheDocument();
  });

  it('loads project members and role on initial fresh load, assigns member using actual userId, and persists assignment across reload', async () => {
    // Fresh board data returned from getBoardWithTasks has no members or userRole on board object
    const unassignedBoard = {
      board: {
        id: '01a18766-48b5-7fb8-a04c-13e1bf648def',
        projectId: 'p-secret-1',
        projectName: 'Secret Ops',
        name: 'Sprint board',
        columns: [
          { id: 'c-todo', name: 'To do', category: ColumnCategory.ToDo, position: '1' },
        ],
        members: [],
      },
      tasks: [
        {
          id: 't-1',
          readableId: 'SEC-1',
          number: 1,
          boardId: '01a18766-48b5-7fb8-a04c-13e1bf648def',
          title: 'Deploy microservice',
          status: ColumnCategory.ToDo,
          columnId: 'c-todo',
          columnName: 'To do',
          priority: TaskPriority.High,
          assignees: [],
          assigneeIds: [],
        } as TaskItem,
      ],
    };

    const reloadedBoardWithBobAssigned = {
      ...unassignedBoard,
      tasks: [
        {
          ...unassignedBoard.tasks[0],
          assignees: [{ id: 'u-bob-uuid', userName: 'bob@example.com' }],
          assigneeIds: ['u-bob-uuid'],
        } as TaskItem,
      ],
    };

    vi.spyOn(api.board, 'getBoardWithTasks')
      .mockResolvedValueOnce(unassignedBoard)
      .mockResolvedValueOnce(reloadedBoardWithBobAssigned);

    // Current authenticated user
    vi.spyOn(api.auth, 'me').mockResolvedValue({ id: 'u-owner-uuid', email: 'owner@example.com' });

    // Project has 3 members with distinct userId (UUID) vs userName (email)
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([
      {
        id: 'p-secret-1',
        key: 'SEC',
        name: 'Secret Ops',
        role: 'OWNER',
        boards: [{ id: '01a18766-48b5-7fb8-a04c-13e1bf648def', name: 'Sprint board' }],
        projectMembers: [
          { userId: 'u-alice-uuid', userName: 'alice@example.com', role: 'OWNER' },
          { userId: 'u-bob-uuid', userName: 'bob@example.com', role: 'WRITER' },
          { userId: 'u-carol-uuid', userName: 'carol@example.com', role: 'READER' },
        ],
      },
    ]);

    const assignSpy = vi.spyOn(api.board, 'assignTask').mockResolvedValue(
      reloadedBoardWithBobAssigned.tasks[0]
    );

    // Initial fresh board load (fresh navigation)
    const { unmount } = renderAt('/boards/01a18766-48b5-7fb8-a04c-13e1bf648def');

    // Open task details
    const taskCard = await screen.findByTestId('task-card-t-1');
    fireEvent.click(taskCard);

    // Click "Change assignee"
    const changeAssigneeBtn = await screen.findByTestId('task-details-change-assignee-btn');
    fireEvent.click(changeAssigneeBtn);

    // Verify all 3 project members are loaded on fresh initial load, not only Unassigned
    expect(await screen.findByTestId('assignee-option-u-alice-uuid')).toHaveTextContent('alice@example.com');
    expect(screen.getByTestId('assignee-option-u-bob-uuid')).toHaveTextContent('bob@example.com');
    expect(screen.getByTestId('assignee-option-u-carol-uuid')).toHaveTextContent('carol@example.com');

    // Select Bob using his option radio
    const bobRadio = screen.getByTestId('assignee-option-u-bob-uuid');
    fireEvent.click(bobRadio);

    // Save changes
    const saveBtn = screen.getByTestId('save-assignee-btn');
    fireEvent.click(saveBtn);

    // Verify assignTask was called with Bob's actual userId ('u-bob-uuid'), NOT his userName ('bob@example.com')
    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith({
        taskId: 't-1',
        userId: 'u-bob-uuid',
      });
    });

    // Verify assignee updated banner
    expect(await screen.findByTestId('assignee-updated-banner')).toHaveTextContent(/assignee updated/i);

    // Simulate page reload/refresh
    unmount();
    renderAt('/boards/01a18766-48b5-7fb8-a04c-13e1bf648def');

    // Verify persisted assignment after reload
    const refreshedCard = await screen.findByTestId('task-card-t-1');
    expect(refreshedCard).toHaveTextContent('BO');

    fireEvent.click(refreshedCard);
    expect(await screen.findByTestId('parent-task-details-modal')).toBeInTheDocument();
    expect(screen.getByTestId('task-details-assignee-name')).toHaveTextContent('bob@example.com');
  });
});
