import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, IncompleteSubtasksApiError, type IncompleteSubtaskDto } from '../api';
import type { BoardDetails, CreateTaskInput, TaskItem, UpdateTaskInput } from '../domain/models';

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
}

export function useBoard(boardId: string): UseBoardState {
  const [board, setBoard] = useState<BoardDetails | null>(null);
  const [tasks, setTasks] = useState<readonly TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);

  const [savingTaskIds, setSavingTaskIds] = useState<ReadonlySet<string>>(new Set<string>());
  const [moveError, setMoveError] = useState<string | null>(null);
  const [incompleteSubtasksError, setIncompleteSubtasksError] = useState<IncompleteSubtaskFailure | null>(null);

  const fetchBoardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      const data = await api.board.getBoardWithTasks(boardId);
      setBoard(data.board);
      setTasks(data.tasks);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
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
        const data = await api.board.getBoardWithTasks(boardId);
        if (!ignore) {
          setBoard(data.board);
          setTasks(data.tasks);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          if (err instanceof ApiError && err.status === 404) {
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
    } catch {
      return false;
    }
  };

  const handleUpdateTask = async (input: UpdateTaskInput): Promise<TaskItem> => {
    const updated = await api.board.updateTask(input);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === updated.id
          ? { ...t, ...updated, parentTaskId: updated.parentTaskId ?? t.parentTaskId }
          : t
      )
    );
    return updated;
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
  };
}
