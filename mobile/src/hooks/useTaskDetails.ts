import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import { reportAccessConfirmed, reportAccessLost } from '../data/projectAccess';
import type { TaskDetails } from '../domain/models';
import { useForegroundRefresh } from './useForegroundRefresh';
import { useProjectAccessWatch } from './useProjectAccessWatch';

export type TaskDetailsState =
  | { status: 'loading' }
  | { status: 'ready'; details: TaskDetails; refreshing: boolean }
  /** `revoked`: the backend refused a task that was on screen (access lost while using it). */
  | { status: 'error'; error: BoardLoadError; revoked: boolean };

const ACCESS_LOST = 'You no longer have access to this project.';

/**
 * Reads the task from the backend each time its screen comes into view, so returning from the
 * Edit task screen shows what the backend saved, not what the form sent. Also when the app comes
 * back to the foreground, on `refresh`, and when access to the project is lost anywhere in the app.
 *
 * `poll`: also check membership now and then while the screen is left open. For screens that only
 * show the task; forms don't, so nobody's typing is replaced while they work.
 */
export function useTaskDetails(boardId: string | undefined, taskId: string | undefined, { poll = false } = {}) {
  const repository = useBoardRepository();
  const [state, setState] = useState<TaskDetailsState>({ status: 'loading' });
  const latest = useRef(0);
  /** The project of the task on screen, once the backend has returned it. */
  const shownProject = useRef<string | null>(null);

  const load = useCallback(() => {
    const request = ++latest.current;
    if (!boardId || !taskId) {
      setState({
        status: 'error',
        error: new BoardLoadError('notFound', 'This link doesn’t point to a task.'),
        revoked: false,
      });
      return;
    }
    repository.getTask(boardId, taskId).then(
      (details) => {
        if (request !== latest.current) return;
        reportAccessConfirmed(details.projectId);
        shownProject.current = details.projectId;
        setState({ status: 'ready', details, refreshing: false });
      },
      (error: unknown) => {
        if (request !== latest.current) return;
        const loadError =
          error instanceof BoardLoadError
            ? error
            : new BoardLoadError('server', error instanceof Error ? error.message : 'Something went wrong.');
        // The board was refused: access to the project is gone, so every open screen of it clears.
        // A task missing from a board the backend did return is only that task.
        const lost = loadError.kind === 'notFound' && loadError.subject === 'project' && !!shownProject.current;
        setState((current) =>
          current.status === 'ready' && loadError.kind !== 'notFound'
            ? { ...current, refreshing: false }
            : { status: 'error', error: loadError, revoked: lost || (current.status === 'error' && current.revoked) },
        );
        if (lost) reportAccessLost(shownProject.current!);
      },
    );
  }, [repository, boardId, taskId]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        latest.current += 1;
      };
    }, [load]),
  );

  // Back from the background: membership may have changed, so ask the backend again.
  useForegroundRefresh(load);

  // Lost anywhere in the app, or found by the check while the screen is left open: clear the task.
  const markLost = useCallback(() => {
    latest.current += 1;
    setState({ status: 'error', error: new BoardLoadError('notFound', ACCESS_LOST), revoked: true });
  }, []);
  useProjectAccessWatch(state.status === 'ready' ? state.details.projectId : null, markLost, poll);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    load();
  }, [load]);

  /** Pull-to-refresh: the task stays while the backend is asked again. */
  const refresh = useCallback(() => {
    setState((current) => (current.status === 'ready' ? { ...current, refreshing: true } : current));
    load();
  }, [load]);

  /** Reads the task again without showing the loading state. */
  const reload = load;

  return { state, retry, refresh, reload };
}
