import { useCallback, useEffect, useRef, useState } from 'react';

import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import type { BoardData, Task } from '../domain/models';

export type BoardScreenState =
  | { status: 'loading' }
  | { status: 'ready'; data: BoardData; refreshing: boolean }
  | { status: 'error'; error: BoardLoadError };

/** The design shows the skeleton only when loading takes longer than this, so it doesn't flash. */
export const SKELETON_DELAY_MS = 300;

const toLoadError = (error: unknown) =>
  error instanceof BoardLoadError
    ? error
    : new BoardLoadError('server', error instanceof Error ? error.message : 'Unknown error');

export function useBoard(boardId: string) {
  const repository = useBoardRepository();
  const [state, setState] = useState<BoardScreenState>({ status: 'loading' });
  const [showSkeleton, setShowSkeleton] = useState(false);
  const latestRequest = useRef(0);
  // Each bump of reloadKey loads the board again; keepData says whether this is a refresh.
  const [reloadKey, setReloadKey] = useState(0);
  const keepData = useRef(false);

  useEffect(() => {
    const request = ++latestRequest.current;
    const isRefresh = keepData.current;
    repository.getBoard(boardId).then(
      (data) => {
        if (request === latestRequest.current) setState({ status: 'ready', data, refreshing: false });
      },
      (error: unknown) => {
        if (request !== latestRequest.current) return;
        const loadError = toLoadError(error);
        setState((current) =>
          // A failed refresh keeps the last good data, unless the board is gone.
          isRefresh && current.status === 'ready' && loadError.kind !== 'notFound'
            ? { ...current, refreshing: false }
            : { status: 'error', error: loadError },
        );
      },
    );
  }, [repository, boardId, reloadKey]);

  useEffect(() => {
    if (state.status !== 'loading') return;
    const timer = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setShowSkeleton(false);
    };
  }, [state.status]);

  /** "Try again" on the error state. */
  const retry = useCallback(() => {
    keepData.current = false;
    setState({ status: 'loading' });
    setReloadKey((k) => k + 1);
  }, []);

  /** Pull-to-refresh and the refresh after creating a task: keeps the current data on screen. */
  const refresh = useCallback(() => {
    keepData.current = true;
    setState((current) => (current.status === 'ready' ? { ...current, refreshing: true } : current));
    setReloadKey((k) => k + 1);
  }, []);

  /** Puts the task returned by createTask on the board, then reloads the board from its source. */
  const addCreatedTask = useCallback(
    (task: Task) => {
      setState((current) =>
        current.status === 'ready' && !current.data.tasks.some((t) => t.id === task.id)
          ? { ...current, data: { ...current.data, tasks: [...current.data.tasks, task] } }
          : current,
      );
      refresh();
    },
    [refresh],
  );

  /** createTask reported that the board no longer exists. */
  const markNotFound = useCallback((message: string) => {
    latestRequest.current += 1;
    setState({ status: 'error', error: new BoardLoadError('notFound', message) });
  }, []);

  return { state, showSkeleton, retry, refresh, addCreatedTask, markNotFound };
}
