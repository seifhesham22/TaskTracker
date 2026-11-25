import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { routes } from '../app/routes';
import { ActiveProjectStorage } from '../context/activeProjectContextDef';
import { ColumnCategory } from '../domain/models';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('Contextual Navbar Navigation (Tasks & Backlog of current project)', () => {
  const mockUser = {
    id: 'u-1',
    userName: 'test@example.com',
    email: 'test@example.com',
  };

  const mockProjectAlpha = {
    id: 'proj-alpha',
    key: 'ALP',
    name: 'Project Alpha',
    role: 'Owner',
    boards: [{ id: 'board-alpha', name: 'Alpha Board', category: 'K' }],
  };

  const mockProjectBeta = {
    id: 'proj-beta',
    key: 'BET',
    name: 'Project Beta',
    role: 'Writer',
    boards: [{ id: 'board-beta', name: 'Beta Board', category: 'K' }],
  };

  const mockBoardAlphaData = {
    board: {
      id: 'board-alpha',
      projectId: 'proj-alpha',
      projectName: 'Project Alpha',
      name: 'Alpha Board',
      userRole: 'Owner',
      columns: [
        { id: 'c-1', name: 'To do', category: ColumnCategory.ToDo, position: '1' },
      ],
      members: [],
    },
    tasks: [],
  };

  const mockBoardBetaData = {
    board: {
      id: 'board-beta',
      projectId: 'proj-beta',
      projectName: 'Project Beta',
      name: 'Beta Board',
      userRole: 'Writer',
      columns: [
        { id: 'c-2', name: 'To do', category: ColumnCategory.ToDo, position: '1' },
      ],
      members: [],
    },
    tasks: [],
  };

  const mockBacklogAlphaData = {
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    ActiveProjectStorage.clear();
    vi.spyOn(api.auth, 'me').mockResolvedValue(mockUser);
    vi.spyOn(api.auth, 'getProjects').mockResolvedValue([mockProjectAlpha, mockProjectBeta]);
  });

  it('updates navbar Backlog link to current project when viewing Alpha board and clicking it opens Alpha backlog', async () => {
    vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardAlphaData);
    const getBacklogSpy = vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue(mockBacklogAlphaData);

    renderAt('/boards/board-alpha');

    // Wait for Alpha board to load and active project state to sync
    expect(await screen.findByRole('heading', { level: 1, name: /alpha board/i })).toBeInTheDocument();

    // Check navbar links
    await waitFor(() => {
      expect(screen.getByTestId('nav-backlog-link')).toHaveAttribute(
        'href',
        '/projects/proj-alpha/backlog'
      );
    });

    const backlogLink = screen.getByTestId('nav-backlog-link');

    // Click Backlog link
    fireEvent.click(backlogLink);

    // Verify Alpha backlog opened
    expect(await screen.findByTestId('project-backlog-page')).toBeInTheDocument();
    await waitFor(() => {
      expect(getBacklogSpy).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-alpha' })
      );
    });
  });

  it('updates navbar Tasks link to current project board when viewing Beta backlog', async () => {
    vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue(mockBacklogAlphaData);
    const getBoardSpy = vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardBetaData);

    renderAt('/projects/proj-beta/backlog');

    // Wait for Beta backlog to load and active project state to sync
    expect(await screen.findByTestId('project-backlog-page')).toBeInTheDocument();

    // Check navbar Tasks link points to Beta's board
    await waitFor(() => {
      expect(screen.getByTestId('nav-tasks-link')).toHaveAttribute('href', '/boards/board-beta');
    });

    const tasksLink = screen.getByTestId('nav-tasks-link');

    // Click Tasks link
    fireEvent.click(tasksLink);

    // Verify Beta board opened
    expect(await screen.findByRole('heading', { level: 1, name: /beta board/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(getBoardSpy).toHaveBeenCalledWith('board-beta');
    });
  });

  it('resolves /tasks without URL id to the active project rather than random seed board', async () => {
    // Set cached active state to Beta
    ActiveProjectStorage.saveActiveState('proj-beta', 'board-beta', 'Project Beta');
    const getBoardSpy = vi.spyOn(api.board, 'getBoardWithTasks').mockResolvedValue(mockBoardBetaData);

    renderAt('/tasks');

    // Should load Beta board
    expect(await screen.findByRole('heading', { level: 1, name: /beta board/i })).toBeInTheDocument();
    expect(getBoardSpy).toHaveBeenCalledWith('board-beta');
  });

  it('resolves /backlog without URL id to the active project backlog', async () => {
    ActiveProjectStorage.saveActiveState('proj-beta', 'board-beta', 'Project Beta');
    const getBacklogSpy = vi.spyOn(api.backlog, 'getBacklog').mockResolvedValue(mockBacklogAlphaData);

    renderAt('/backlog');

    expect(await screen.findByTestId('project-backlog-page')).toBeInTheDocument();
    await waitFor(() => {
      expect(getBacklogSpy).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-beta' })
      );
    });
  });
});
