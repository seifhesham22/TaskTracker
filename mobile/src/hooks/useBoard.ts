import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import type { BoardColumn, BoardData, Task } from '../domain/models';
import { isActiveCategory, unfinishedBlockers, type Blocker } from '../domain/blockers';
import { toMoveTaskError } from '../domain/moveTaskErrors';
import { reportAccessConfirmed, reportAccessLost } from '../data/projectAccess';
import { useForegroundRefresh } from './useForegroundRefresh';

export type BoardScreenState =
  | { status: 'loading' }
  | { status: 'ready'; data: BoardData; refreshing: boolean }
  /** `revoked`: the backend refused a board that was on screen (access lost while using it). */
  | { status: 'error'; error: BoardLoadError; revoked: boolean };

export type MoveTaskOutcome =
  | { status: 'moved'; task: Task }
  | { status: 'failed'; message: string }
  /** US-17: unfinished blockers; nothing was moved. */
  | { status: 'blocked'; blockers: Blocker[] }
  | { status: 'alreadySaving' };

// TaskLookupService's NOT_FOUND message, for a missing task or one in a project the user isn't in.
const TASK_GONE = /^Task '[^']+' was not found\.$/;

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
  const latestRequest = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);
  const keepData = useRef(false);
  const reportRefreshFailure = useRef(false);
  const loadInFlight = useRef(false);
  const savingTasks = useRef(new Set<string>());
  const [pendingMoves, setPendingMoves] = useState<Record<string, BoardColumn>>({});
  /** The project of the board on screen, once the backend has returned it. */
  const shownProject = useRef<string | null>(null);

  useEffect(() => {
    const request = ++latestRequest.current;
    loadInFlight.current = true;
    const isRefresh = keepData.current;
    const reportFailure = reportRefreshFailure.current;
    repository.getBoard(boardId).then(
      (data) => {
        if (request !== latestRequest.current) return;
        loadInFlight.current = false;
        reportAccessConfirmed(data.board.projectId);
        shownProject.current = data.board.projectId;
        setState({ status: 'ready', data, refreshing: false });
      },
      (error: unknown) => {
        if (request !== latestRequest.current) return;
        loadInFlight.current = false;
        const loadError = toLoadError(error);
        setState((current) =>
          isRefresh && current.status === 'ready' && loadError.kind !== 'notFound'
            ? { ...current, refreshing: false }
            : {
                status: 'error',
                error: loadError,
                revoked: current.status === 'ready' || (current.status === 'error' && current.revoked),
              },
        );
        if (isRefresh && reportFailure && loadError.kind !== 'notFound') onRefreshFailed?.();
        // Refused after it was shown: every open screen of the project clears, not only this one.
        if (loadError.kind === 'notFound' && shownProject.current) reportAccessLost(shownProject.current);
      },
    );
  }, [repository, boardId, reloadKey, onRefreshFailed]);

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

  // Back from the background: membership may have changed, so ask the backend again.
  useForegroundRefresh(reloadQuietly);

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
    // Only an open board can report this, so it was on screen.
    setState({ status: 'error', error: new BoardLoadError('notFound', message), revoked: true });
    if (shownProject.current) reportAccessLost(shownProject.current);
  }, []);

  const moveTask = useCallback(
    async (task: Task, column: BoardColumn): Promise<MoveTaskOutcome> => {
      if (savingTasks.current.has(task.id)) return { status: 'alreadySaving' };
      // US-17: a task with an unfinished blocker isn't started: nothing is sent, the card stays put.
      // The backend checks again on every move, with the blockers as they are now.
      const known = isActiveCategory(column.category) ? unfinishedBlockers(task) : [];
      if (known.length > 0) return { status: 'blocked', blockers: known };
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
        const failure = toMoveTaskError(error);
        if (failure.blockers) return { status: 'blocked', blockers: failure.blockers };
        const message = failure.message;
        // The backend answers a task the user may no longer see as not found: read the board again,
        // which replaces it with the access screen if access was lost.
        if (TASK_GONE.test(message)) {
          keepData.current = true;
          reportRefreshFailure.current = false;
          setReloadKey((k) => k + 1);
        }
        return { status: 'failed', message };
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

  return {
    state: shownState,
    retry,
    refresh,
    reloadQuietly,
    addCreatedTask,
    markNotFound,
    moveTask,
    savingTaskIds,
  };
}
