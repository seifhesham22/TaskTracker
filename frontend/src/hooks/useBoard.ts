import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  BlockedTaskStartApiError,
  IncompleteSubtasksApiError,
  type IncompleteSubtaskDto,
} from '../api';
import {
  ColumnCategory,
  type BlockedTaskStartFailure,
  type BoardDetails,
  type CreateTaskInput,
  type GetBoardTasksOptions,
  type TaskDependencyRef,
  type TaskItem,
  type TaskPriority,
  type UpdateTaskInput,
} from '../domain/models';
import { defaultProjectAccessClassifier, type ProjectAccessState } from '../domain/projectAccess';

export interface IncompleteSubtaskFailure {
  readonly taskId: string;
  readonly message: string;
  readonly incompleteSubtasks: readonly IncompleteSubtaskDto[];
}

export interface UseBoardState {
  readonly board: BoardDetails | null;
  readonly tasks: readonly TaskItem[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isNotFound: boolean;
  readonly accessState: ProjectAccessState;
  readonly isCreatingTask: boolean;
  readonly createTaskError: string | null;
  readonly savingTaskIds: ReadonlySet<string>;
  readonly moveError: string | null;
  readonly moveRevertedBanner: string | null;
  readonly incompleteSubtasksError: IncompleteSubtaskFailure | null;
  readonly blockedStartError: BlockedTaskStartFailure | null;
  readonly clearMoveError: () => void;
  readonly clearMoveRevertedBanner: () => void;
  readonly clearIncompleteSubtasksError: () => void;
  readonly clearBlockedStartError: () => void;
  readonly handleRecheckBlockers: (taskId: string) => Promise<readonly TaskDependencyRef[]>;
  readonly handleStartBlockedTask: (taskId: string, targetColumnId?: string) => Promise<boolean>;
  readonly reload: () => Promise<void>;
  readonly handleCreateTask: (input: CreateTaskInput) => Promise<boolean>;
  readonly handleCreateSubtask: (parentTask: TaskItem, title: string) => Promise<boolean>;
  readonly handleMoveTask: (taskId: string, targetColumnId: string) => Promise<boolean>;
  readonly handleUpdateTask: (input: UpdateTaskInput) => Promise<TaskItem>;
  readonly handleAssignTask: (taskId: string, userId: string) => Promise<boolean>;
  readonly handleUnassignTask: (taskId: string, userId: string) => Promise<boolean>;
  readonly handleAddDependency: (blockingTaskId: string, blockedTaskId: string) => Promise<boolean>;
  readonly handleSearchTasks: (query: string) => Promise<TaskItem[]>;

  // Search and filter additions [US-36]
  readonly search: string;
  readonly debouncedSearch: string;
  readonly statusFilter: ColumnCategory | null;
  readonly priorityFilter: TaskPriority | 'NONE' | null;
  readonly assigneeFilter: string | 'UNASSIGNED' | null;
  readonly assigneeName: string | null;
  readonly isFilterLoading: boolean;
  readonly filterError: string | null;
  readonly totalPermittedCount: number;
  readonly hasActiveFilters: boolean;
  readonly activeFilterCount: number;
  readonly setSearch: (term: string) => void;
  readonly setStatusFilter: (status: ColumnCategory | null) => void;
  readonly setPriorityFilter: (priority: TaskPriority | 'NONE' | null) => void;
  readonly setAssigneeFilter: (assigneeId: string | 'UNASSIGNED' | null, assigneeName?: string | null) => void;
  readonly applyFilters: (
    status: ColumnCategory | null,
    priority: TaskPriority | 'NONE' | null,
    assigneeId: string | 'UNASSIGNED' | null,
    assigneeName?: string | null
  ) => void;
  readonly clearAllFilters: () => void;
  readonly removeFilter: (kind: 'search' | 'status' | 'priority' | 'assignee') => void;
  readonly retryFilter: () => void;
}

async function loadBoardWithMembers(
  boardId: string,
  options?: GetBoardTasksOptions
): Promise<{
  board: BoardDetails;
  tasks: TaskItem[];
}> {
  const data = options
    ? await api.board.getBoardWithTasks(boardId, options)
    : await api.board.getBoardWithTasks(boardId);
  let members = data.board.members && data.board.members.length > 0 ? [...data.board.members] : [];
  let userRole: string | undefined = data.board.userRole;
  let projectName = data.board.projectName;

  try {
    const me = await api.auth.me();
    const projects = me ? await api.auth.getProjects(me.id) : [];
    const currentProject = projects.find((p) => p.id === data.board.projectId);
    if (currentProject) {
      userRole = currentProject.role || userRole;
      if (!projectName) projectName = currentProject.name;
      if (currentProject.projectMembers && currentProject.projectMembers.length > 0) {
        members = currentProject.projectMembers.map((m) => ({
          userId: m.userId || m.userName,
          userName: m.userName,
          role: m.role,
        }));
      }
    }
  } catch {
    // continue with existing board data
  }

  return {
    board: {
      ...data.board,
      projectName,
      members,
      userRole,
    },
    tasks: data.tasks,
  };
}

export function useBoard(boardId: string): UseBoardState {
  const [board, setBoard] = useState<BoardDetails | null>(null);
  const [tasks, setTasks] = useState<readonly TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [accessState, setAccessState] = useState<ProjectAccessState>('checking');

  // Search and filter state [US-36]
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ColumnCategory | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'NONE' | null>(null);
  const [assigneeFilter, setAssigneeFilterState] = useState<string | 'UNASSIGNED' | null>(null);
  const [assigneeName, setAssigneeName] = useState<string | null>(null);
  const [isFilterLoading, setIsFilterLoading] = useState<boolean>(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [totalPermittedCount, setTotalPermittedCount] = useState<number>(0);
  const [filterReloadTrigger, setFilterReloadTrigger] = useState(0);

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedInitialRef = useRef<boolean>(false);

  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);

  const [savingTaskIds, setSavingTaskIds] = useState<ReadonlySet<string>>(new Set<string>());
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveRevertedBanner, setMoveRevertedBanner] = useState<string | null>(null);
  const [incompleteSubtasksError, setIncompleteSubtasksError] = useState<IncompleteSubtaskFailure | null>(null);
  const [blockedStartError, setBlockedStartError] = useState<BlockedTaskStartFailure | null>(null);

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() || statusFilter || priorityFilter || assigneeFilter
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter) count++;
    if (priorityFilter) count++;
    if (assigneeFilter) count++;
    return count;
  }, [statusFilter, priorityFilter, assigneeFilter]);

  const setSearch = useCallback((query: string) => {
    setSearchState(query);
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(query);
    }, 250);
  }, []);

  const setAssigneeFilter = useCallback((assigneeId: string | 'UNASSIGNED' | null, label?: string | null) => {
    setAssigneeFilterState(assigneeId);
    setAssigneeName(label ?? null);
    setFilterError(null);
  }, []);

  const applyFilters = useCallback(
    (
      status: ColumnCategory | null,
      priority: TaskPriority | 'NONE' | null,
      assigneeId: string | 'UNASSIGNED' | null,
      assigneeLabel?: string | null
    ) => {
      setStatusFilter(status);
      setPriorityFilter(priority);
      setAssigneeFilterState(assigneeId);
      setAssigneeName(assigneeLabel ?? null);
      setFilterError(null);
    },
    []
  );

  const clearAllFilters = useCallback(() => {
    setSearchState('');
    setDebouncedSearch('');
    setStatusFilter(null);
    setPriorityFilter(null);
    setAssigneeFilterState(null);
    setAssigneeName(null);
    setFilterError(null);
  }, []);

  const removeFilter = useCallback((kind: 'search' | 'status' | 'priority' | 'assignee') => {
    if (kind === 'search') {
      setSearchState('');
      setDebouncedSearch('');
    } else if (kind === 'status') {
      setStatusFilter(null);
    } else if (kind === 'priority') {
      setPriorityFilter(null);
    } else if (kind === 'assignee') {
      setAssigneeFilterState(null);
      setAssigneeName(null);
    }
    setFilterError(null);
  }, []);

  const retryFilter = useCallback(() => {
    setFilterReloadTrigger((prev) => prev + 1);
  }, []);

  const checkActionRevocation = useCallback((err: unknown): boolean => {
    const classified = defaultProjectAccessClassifier.classifyError(err, true);
    if (
      classified === 'revoked' ||
      classified === 'unavailable' ||
      classified === 'session_expired'
    ) {
      setAccessState(classified);
      setBoard(null);
      setTasks([]);
      return true;
    }
    return false;
  }, []);

  const fetchBoardData = useCallback(async () => {
    setIsLoading(true);
    setAccessState('checking');
    setError(null);
    setIsNotFound(false);

    try {
      const where = api.board.buildTaskFilter(statusFilter, priorityFilter, assigneeFilter);
      const options: GetBoardTasksOptions | undefined = hasActiveFilters
        ? {
            search: debouncedSearch.trim() || undefined,
            where,
          }
        : undefined;

      const { board: loadedBoard, tasks: loadedTasks } = await loadBoardWithMembers(boardId, options);
      setBoard(loadedBoard);
      setTasks(loadedTasks);
      setAccessState('permitted');
      if (!hasActiveFilters) {
        setTotalPermittedCount(loadedTasks.length);
      }
    } catch (err: unknown) {
      const classified = defaultProjectAccessClassifier.classifyError(err, false);
      setAccessState(classified);
      setBoard(null);
      setTasks([]);
      if (classified === 'unavailable') {
        setIsNotFound(true);
        setError(`Board '${boardId}' was not found.`);
      } else {
        const message = err instanceof Error ? err.message : 'Failed to load board data from server.';
        setError(message);
      }
    } finally {
      setIsLoading(false);
      setIsFilterLoading(false);
    }
  }, [boardId, debouncedSearch, statusFilter, priorityFilter, assigneeFilter, hasActiveFilters]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      const isInitial = !hasLoadedInitialRef.current;
      if (isInitial) {
        setIsLoading(true);
      } else {
        setIsFilterLoading(true);
      }
      setFilterError(null);

      try {
        const where = api.board.buildTaskFilter(statusFilter, priorityFilter, assigneeFilter);
        const options: GetBoardTasksOptions | undefined = hasActiveFilters
          ? {
              search: debouncedSearch.trim() || undefined,
              where,
            }
          : undefined;

        const { board: loadedBoard, tasks: loadedTasks } = await loadBoardWithMembers(boardId, options);
        if (!ignore) {
          setBoard(loadedBoard);
          setTasks(loadedTasks);
          if (!hasActiveFilters || isInitial) {
            setTotalPermittedCount(loadedTasks.length);
          }
          setAccessState('permitted');
          hasLoadedInitialRef.current = true;
        }
      } catch (err: unknown) {
        if (!ignore) {
          if (isInitial) {
            const classified = defaultProjectAccessClassifier.classifyError(err, false);
            setAccessState(classified);
            setBoard(null);
            setTasks([]);
            if (classified === 'unavailable') {
              setIsNotFound(true);
              setError(`Board '${boardId}' was not found.`);
            } else {
              const message = err instanceof Error ? err.message : 'Failed to load board data from server.';
              setError(message);
            }
          } else {
            if (!checkActionRevocation(err)) {
              // General filter query failure (State 08)
              setFilterError(err instanceof Error ? err.message : 'Couldn’t load matching tasks. Try again.');
            }
          }
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
          setIsFilterLoading(false);
        }
      }
    };

    run();

    return () => {
      ignore = true;
    };
  }, [
    boardId,
    debouncedSearch,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    filterReloadTrigger,
    hasActiveFilters,
    checkActionRevocation,
  ]);

  const handleCreateTask = async (input: CreateTaskInput): Promise<boolean> => {
    setIsCreatingTask(true);
    setCreateTaskError(null);

    try {
      const newTask = await api.board.createTask(input);
      // Immediately reflect on board without page reload
      setTasks((prevTasks) => [...prevTasks, newTask]);
      return true;
    } catch (err: unknown) {
      if (checkActionRevocation(err)) {
        return false;
      }
      const msg = err instanceof Error ? err.message : 'Server refused task creation.';
      setCreateTaskError(msg);
      return false;
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleMoveTask = async (taskId: string, targetColumnId: string): Promise<boolean> => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return false;

    // Moving a task to the column it is already in changes nothing.
    if (task.columnId === targetColumnId) {
      return true;
    }

    const targetColumn = board?.columns.find((c) => c.id === targetColumnId);
    if (!targetColumn) return false;

    const previousTasks = tasks;

    // Optimistically update the task's column and status without a page reload
    const optimisticTask: TaskItem = {
      ...task,
      columnId: targetColumn.id,
      columnName: targetColumn.name,
      status: targetColumn.category,
    };

    setTasks((prev) => prev.map((t) => (t.id === taskId ? optimisticTask : t)));
    setSavingTaskIds((prev) => new Set(prev).add(taskId));
    setMoveError(null);
    setMoveRevertedBanner(null);
    setIncompleteSubtasksError(null);
    setBlockedStartError((prev) => (prev && prev.taskId === taskId ? prev : null));

    try {
      const updatedTask = await api.board.moveTask({ taskId, columnId: targetColumnId });
      // The new status shows everywhere the task appears on the page, from the same response.
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, ...updatedTask, parentTaskId: updatedTask.parentTaskId ?? t.parentTaskId }
            : t
        )
      );
      return true;
    } catch (err: unknown) {
      if (checkActionRevocation(err)) {
        return false;
      }
      // If the change is refused (network error or validation guard), the card stays where it was.
      setTasks(previousTasks);
      if (err instanceof BlockedTaskStartApiError) {
        const fromColName =
          task.columnName ||
          board?.columns.find((c) => c.id === task.columnId)?.name ||
          'To do';
        const bannerText = `Move reverted · ${task.readableId} stays in ${fromColName}.`;
        setMoveRevertedBanner(bannerText);
        setBlockedStartError({
          taskId,
          taskTitle: task.title,
          readableId: task.readableId,
          projectName: board?.projectName || board?.name || '',
          currentStatus: task.status,
          currentColumnName: fromColName,
          targetColumnId,
          blockers: err.blockers.map((b) => {
            const fromBlockedBy = task.blockedBy?.find((dep) => dep.id === b.id)?.status;
            const fromTasks = tasks.find((t) => t.id === b.id)?.status;
            return {
              id: b.id,
              readableId: b.readableId,
              title: b.title,
              status: (b.status as ColumnCategory) || fromBlockedBy || fromTasks || ColumnCategory.Backlog,
            };
          }),
          message: err.message,
        });
        setMoveError(bannerText);
      } else if (err instanceof IncompleteSubtasksApiError) {
        setIncompleteSubtasksError({
          taskId,
          message: err.message,
          incompleteSubtasks: err.incompleteSubtasks,
        });
        setMoveError(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Server refused to move task.';
        setMoveError(msg);
      }
      return false;
    } finally {
      setSavingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleRecheckBlockers = async (
    targetTaskId: string
  ): Promise<readonly TaskDependencyRef[]> => {
    const { board: reloadedBoard, tasks: reloadedTasks } = await loadBoardWithMembers(boardId);
    setBoard(reloadedBoard);
    setTasks(reloadedTasks);
    const updatedTask = reloadedTasks.find((t) => t.id === targetTaskId);
    if (!updatedTask || !updatedTask.blockedBy) {
      return [];
    }
    return updatedTask.blockedBy;
  };

  const handleStartBlockedTask = async (
    targetTaskId: string,
    targetColumnId?: string
  ): Promise<boolean> => {
    let colId = targetColumnId;
    if (!colId) {
      const inProgressCol = board?.columns.find(
        (c) => c.category === ColumnCategory.InProgress
      );
      colId = inProgressCol?.id;
    }
    if (!colId) return false;
    return await handleMoveTask(targetTaskId, colId);
  };

  const handleCreateSubtask = async (parentTask: TaskItem, title: string): Promise<boolean> => {
    try {
      const newSubtask = await api.board.createSubtask(parentTask, title);
      setTasks((prevTasks) => [...prevTasks, newSubtask]);
      return true;
    } catch (err: unknown) {
      if (checkActionRevocation(err)) {
        return false;
      }
      return false;
    }
  };

  const handleUpdateTask = async (input: UpdateTaskInput): Promise<TaskItem> => {
    try {
      const updated = await api.board.updateTask(input);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === updated.id
            ? { ...t, ...updated, parentTaskId: updated.parentTaskId ?? t.parentTaskId }
            : t
        )
      );
      return updated;
    } catch (err: unknown) {
      if (checkActionRevocation(err)) {
        throw err;
      }
      throw err;
    }
  };

  const handleAddDependency = async (
    blockingTaskId: string,
    blockedTaskId: string
  ): Promise<boolean> => {
    try {
      const result = await api.board.addTaskDependency({ blockingTaskId, blockedTaskId });
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === result.blockingTask.id) {
            return {
              ...t,
              ...result.blockingTask,
              blocks: result.blockingTask.blocks ?? t.blocks,
              blockedBy: result.blockingTask.blockedBy ?? t.blockedBy,
            };
          }
          if (t.id === result.blockedTask.id) {
            return {
              ...t,
              ...result.blockedTask,
              blocks: result.blockedTask.blocks ?? t.blocks,
              blockedBy: result.blockedTask.blockedBy ?? t.blockedBy,
            };
          }
          return t;
        })
      );
      return true;
    } catch (err: unknown) {
      if (checkActionRevocation(err)) {
        return false;
      }
      throw err;
    }
  };

  const handleAssignTask = async (taskId: string, userId: string): Promise<boolean> => {
    const updated = await api.board.assignTask({ taskId, userId });
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t))
    );
    return true;
  };

  const handleUnassignTask = async (taskId: string, userId: string): Promise<boolean> => {
    const updated = await api.board.unassignTask({ taskId, userId });
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t))
    );
    return true;
  };

  const handleSearchTasks = async (query: string): Promise<TaskItem[]> => {
    const trimmed = query.trim().toLowerCase();
    if (board?.projectId) {
      try {
        const backlogResults = await api.board.searchTasks(board.projectId, trimmed);
        if (backlogResults.length > 0) {
          return backlogResults;
        }
      } catch (err: unknown) {
        if (checkActionRevocation(err)) {
          return [];
        }
        // Fallback to in-memory tasks
      }
    }

    if (!trimmed) {
      return tasks.slice();
    }

    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(trimmed) ||
        t.readableId.toLowerCase().includes(trimmed)
    );
  };

  const clearMoveError = useCallback(() => {
    setMoveError(null);
    setMoveRevertedBanner(null);
  }, []);

  const clearMoveRevertedBanner = useCallback(() => {
    setMoveRevertedBanner(null);
  }, []);

  const clearIncompleteSubtasksError = useCallback(() => {
    setIncompleteSubtasksError(null);
  }, []);

  const clearBlockedStartError = useCallback(() => {
    setBlockedStartError(null);
  }, []);

  return {
    board,
    tasks,
    isLoading,
    error,
    isNotFound,
    accessState,
    isCreatingTask,
    createTaskError,
    savingTaskIds,
    moveError,
    moveRevertedBanner,
    incompleteSubtasksError,
    blockedStartError,
    clearMoveError,
    clearMoveRevertedBanner,
    clearIncompleteSubtasksError,
    clearBlockedStartError,
    handleRecheckBlockers,
    handleStartBlockedTask,
    reload: fetchBoardData,
    handleCreateTask,
    handleCreateSubtask,
    handleMoveTask,
    handleUpdateTask,
    handleAssignTask,
    handleUnassignTask,
    handleAddDependency,
    handleSearchTasks,

    // Search and filter additions [US-36]
    search,
    debouncedSearch,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    assigneeName,
    isFilterLoading,
    filterError,
    totalPermittedCount,
    hasActiveFilters,
    activeFilterCount,
    setSearch,
    setStatusFilter,
    setPriorityFilter,
    setAssigneeFilter,
    applyFilters,
    clearAllFilters,
    removeFilter,
    retryFilter,
  };
}
