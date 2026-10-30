import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { BoardDetails, CreateTaskInput, TaskItem } from '../domain/models';

export interface UseBoardState {
  readonly board: BoardDetails | null;
  readonly tasks: readonly TaskItem[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isNotFound: boolean;
  readonly isCreatingTask: boolean;
  readonly createTaskError: string | null;
  readonly reload: () => Promise<void>;
  readonly handleCreateTask: (input: CreateTaskInput) => Promise<boolean>;
}

export function useBoard(boardId: string): UseBoardState {
  const [board, setBoard] = useState<BoardDetails | null>(null);
  const [tasks, setTasks] = useState<readonly TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);

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

  return {
    board,
    tasks,
    isLoading,
    error,
    isNotFound,
    isCreatingTask,
    createTaskError,
    reload: fetchBoardData,
    handleCreateTask,
  };
}
