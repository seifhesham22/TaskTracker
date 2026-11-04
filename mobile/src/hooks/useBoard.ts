import { useCallback, useEffect, useRef, useState } from 'react';

import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import type { BoardData, Task } from '../domain/models';

export type BoardScreenState =
  | { status: 'loading' }
  | { status: 'ready'; data: BoardData; refreshing: boolean }
  | { status: 'error'; error: BoardLoadError };

export const SKELETON_DELAY_MS = 300;

export const REFRESH_FAILED_MESSAGE = 'Couldn’t refresh the board. Pull down to try again.';

const toLoadError = (error: unknown) =>
  error instanceof BoardLoadError
    ? error
    : new BoardLoadError('server', error instanceof Error ? error.message : 'Unknown error');

export function useBoard(boardId: string, onRefreshFailed?: () => void) {
  const repository = useBoardRepository();
  const [state, setState] = useState<BoardScreenState>({ status: 'loading' });
  const [showSkeleton, setShowSkeleton] = useState(false);
  const latestRequest = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);
  const keepData = useRef(false);
  const reportRefreshFailure = useRef(false);

  useEffect(() => {
    const request = ++latestRequest.current;
    const isRefresh = keepData.current;
    const reportFailure = reportRefreshFailure.current;
    repository.getBoard(boardId).then(
      (data) => {
        if (request === latestRequest.current) setState({ status: 'ready', data, refreshing: false });
      },
      (error: unknown) => {
        if (request !== latestRequest.current) return;
        const loadError = toLoadError(error);
        setState((current) =>
          isRefresh && current.status === 'ready' && loadError.kind !== 'notFound'
            ? { ...current, refreshing: false }
            : { status: 'error', error: loadError },
        );
        if (isRefresh && reportFailure && loadError.kind !== 'notFound') onRefreshFailed?.();
      },
    );
  }, [repository, boardId, reloadKey, onRefreshFailed]);

  useEffect(() => {
    if (state.status !== 'loading') return;
    const timer = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setShowSkeleton(false);
    };
  }, [state.status]);

  const retry = useCallback(() => {
    keepData.current = false;
    setState({ status: 'loading' });
    setReloadKey((k) => k + 1);
  }, []);

  const refresh = useCallback(() => {
    keepData.current = true;
    reportRefreshFailure.current = true;
    setState((current) => (current.status === 'ready' ? { ...current, refreshing: true } : current));
    setReloadKey((k) => k + 1);
  }, []);

  const reloadQuietly = useCallback(() => {
    keepData.current = true;
    reportRefreshFailure.current = false;
    setReloadKey((k) => k + 1);
  }, []);

  const addCreatedTask = useCallback(
    (task: Task) => {
      setState((current) =>
        current.status === 'ready' && !current.data.tasks.some((t) => t.id === task.id)
          ? { ...current, data: { ...current.data, tasks: [...current.data.tasks, task] } }
          : current,
      );
      reloadQuietly();
    },
    [reloadQuietly],
  );

  const markNotFound = useCallback((message: string) => {
    latestRequest.current += 1;
    setState({ status: 'error', error: new BoardLoadError('notFound', message) });
  }, []);

  return { state, showSkeleton, retry, refresh, addCreatedTask, markNotFound };
}
