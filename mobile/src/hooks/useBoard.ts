import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import type { BoardColumn, BoardData, Task } from '../domain/models';
import { toMoveTaskFailureMessage } from '../domain/moveTaskErrors';

export type BoardScreenState =
  | { status: 'loading' }
  | { status: 'ready'; data: BoardData; refreshing: boolean }
  | { status: 'error'; error: BoardLoadError };

export type MoveTaskOutcome = { status: 'moved'; task: Task } | { status: 'failed'; message: string } | { status: 'alreadySaving' };

export const SKELETON_DELAY_MS = 300;

export const REFRESH_FAILED_MESSAGE = 'Couldn’t refresh the board. Pull down to try again.';

const toLoadError = (error: unknown) =>
  error instanceof BoardLoadError
    ? error
    : new BoardLoadError('server', error instanceof Error ? error.message : 'Unknown error');

function withPendingMove(task: Task, column: BoardColumn): Task {
  return { ...task, columnId: column.id, columnName: column.name, status: column.category, position: undefined };
}

export function useBoard(boardId: string, onRefreshFailed?: () => void) {
  const repository = useBoardRepository();
  const [state, setState] = useState<BoardScreenState>({ status: 'loading' });
  const [showSkeleton, setShowSkeleton] = useState(false);
  const latestRequest = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);
  const keepData = useRef(false);
  const reportRefreshFailure = useRef(false);
  const loadInFlight = useRef(false);
  const savingTasks = useRef(new Set<string>());
  const [pendingMoves, setPendingMoves] = useState<Record<string, BoardColumn>>({});

  useEffect(() => {
    const request = ++latestRequest.current;
    loadInFlight.current = true;
    const isRefresh = keepData.current;
    const reportFailure = reportRefreshFailure.current;
    repository.getBoard(boardId).then(
      (data) => {
        if (request !== latestRequest.current) return;
        loadInFlight.current = false;
        setState({ status: 'ready', data, refreshing: false });
      },
      (error: unknown) => {
        if (request !== latestRequest.current) return;
        loadInFlight.current = false;
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
    loadInFlight.current = false;
    setState({ status: 'error', error: new BoardLoadError('notFound', message) });
  }, []);

  const moveTask = useCallback(
    async (task: Task, column: BoardColumn): Promise<MoveTaskOutcome> => {
      if (savingTasks.current.has(task.id)) return { status: 'alreadySaving' };
      savingTasks.current.add(task.id);
      setPendingMoves((moves) => ({ ...moves, [task.id]: column }));
      try {
        const moved = await repository.moveTask(task.id, column.id);
        setState((current) =>
          current.status === 'ready'
            ? { ...current, data: { ...current.data, tasks: current.data.tasks.map((t) => (t.id === moved.id ? moved : t)) } }
            : current,
        );
        if (loadInFlight.current) setReloadKey((k) => k + 1);
        return { status: 'moved', task: moved };
      } catch (error) {
        return { status: 'failed', message: toMoveTaskFailureMessage(error) };
      } finally {
        savingTasks.current.delete(task.id);
        setPendingMoves((moves) => {
          const remaining = { ...moves };
          delete remaining[task.id];
          return remaining;
        });
      }
    },
    [repository],
  );

  const savingTaskIds = useMemo(() => new Set(Object.keys(pendingMoves)), [pendingMoves]);

  const shownState = useMemo<BoardScreenState>(() => {
    if (state.status !== 'ready' || savingTaskIds.size === 0) return state;
    const tasks = state.data.tasks.map((task) => {
      const column = pendingMoves[task.id];
      return column ? withPendingMove(task, column) : task;
    });
    return { ...state, data: { ...state.data, tasks } };
  }, [state, pendingMoves, savingTaskIds]);

  return { state: shownState, showSkeleton, retry, refresh, addCreatedTask, markNotFound, moveTask, savingTaskIds };
}
