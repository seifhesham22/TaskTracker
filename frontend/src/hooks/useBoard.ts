import { useCallback, useEffect, useState } from 'react';
import { api, IncompleteSubtasksApiError, type IncompleteSubtaskDto } from '../api';
import type { BoardDetails, CreateTaskInput, TaskItem, UpdateTaskInput } from '../domain/models';
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
  readonly incompleteSubtasksError: IncompleteSubtaskFailure | null;
  readonly clearMoveError: () => void;
  readonly clearIncompleteSubtasksError: () => void;
  readonly reload: () => Promise<void>;
  readonly handleCreateTask: (input: CreateTaskInput) => Promise<boolean>;
  readonly handleCreateSubtask: (parentTask: TaskItem, title: string) => Promise<boolean>;
  readonly handleMoveTask: (taskId: string, targetColumnId: string) => Promise<boolean>;
  readonly handleUpdateTask: (input: UpdateTaskInput) => Promise<TaskItem>;
  readonly handleAssignTask: (taskId: string, userId: string) => Promise<boolean>;
  readonly handleUnassignTask: (taskId: string, userId: string) => Promise<boolean>;
  readonly handleAddDependency: (blockingTaskId: string, blockedTaskId: string) => Promise<boolean>;
  readonly handleSearchTasks: (query: string) => Promise<TaskItem[]>;
}

async function loadBoardWithMembers(boardId: string): Promise<{
  board: BoardDetails;
  tasks: TaskItem[];
}> {
  const data = await api.board.getBoardWithTasks(boardId);
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

  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);

  const [savingTaskIds, setSavingTaskIds] = useState<ReadonlySet<string>>(new Set<string>());
  const [moveError, setMoveError] = useState<string | null>(null);
  const [incompleteSubtasksError, setIncompleteSubtasksError] = useState<IncompleteSubtaskFailure | null>(null);

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
      const { board: loadedBoard, tasks: loadedTasks } = await loadBoardWithMembers(boardId);
      setBoard(loadedBoard);
      setTasks(loadedTasks);
      setAccessState('permitted');
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
    }
  }, [boardId]);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      try {
        const { board: loadedBoard, tasks: loadedTasks } = await loadBoardWithMembers(boardId);
        if (!ignore) {
          setBoard(loadedBoard);
          setTasks(loadedTasks);
          setAccessState('permitted');
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
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
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      ignore = true;
    };
  }, [boardId]);

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
    setIncompleteSubtasksError(null);

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
      if (err instanceof IncompleteSubtasksApiError) {
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
  }, []);

  const clearIncompleteSubtasksError = useCallback(() => {
    setIncompleteSubtasksError(null);
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
    incompleteSubtasksError,
    clearMoveError,
    clearIncompleteSubtasksError,
    reload: fetchBoardData,
    handleCreateTask,
    handleCreateSubtask,
    handleMoveTask,
    handleUpdateTask,
    handleAssignTask,
    handleUnassignTask,
    handleAddDependency,
    handleSearchTasks,
  };
}
