import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import type { ProjectMembers } from '../domain/members';
import { reportAccessConfirmed, reportAccessLost } from '../data/projectAccess';
import { useForegroundRefresh } from './useForegroundRefresh';
import { useProjectAccessWatch } from './useProjectAccessWatch';

export type ProjectMembersState =
  | { status: 'loading' }
  | { status: 'ready'; project: ProjectMembers; refreshFailed: boolean; refreshing: boolean }
  /** `revoked`: the backend refused a project that was on screen (access lost while using it). */
  | { status: 'error'; error: unknown; revoked: boolean };

const ACCESS_LOST = 'You no longer have access to this project.';

/**
 * The project's members, read from the backend each time the screen comes into view, when the app
 * comes back to the foreground, on `refresh`, and cleared when access is lost anywhere in the app.
 * `poll`: also check membership now and then while the screen is left open (the list, not forms).
 */
export function useProjectMembers(projectId: string | undefined, { poll = false } = {}) {
  const repository = useBoardRepository();
  const [state, setState] = useState<ProjectMembersState>({ status: 'loading' });
  const latest = useRef(0);
  /** Whether the members have been on screen, so a refusal is “access changed”. */
  const shown = useRef(false);

  const load = useCallback(() => {
    const request = ++latest.current;
    repository.getProjectMembers(projectId ?? '').then(
      (project) => {
        if (request !== latest.current) return;
        reportAccessConfirmed(project.projectId);
        shown.current = true;
        setState({ status: 'ready', project, refreshFailed: false, refreshing: false });
      },
      (error: unknown) => {
        if (request !== latest.current) return;
        const notFound = error instanceof BoardLoadError && error.kind === 'notFound';
        // A failed refresh keeps the members already shown; losing access to the project doesn't.
        setState((current) =>
          current.status === 'ready' && !notFound
            ? { ...current, refreshFailed: true, refreshing: false }
            : { status: 'error', error, revoked: notFound && shown.current },
        );
        if (notFound && shown.current && projectId) reportAccessLost(projectId);
      },
    );
  }, [repository, projectId]);

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

  // Lost anywhere in the app, or found by the check while the list is left open: clear it.
  const markLost = useCallback(() => {
    latest.current += 1;
    setState({ status: 'error', error: new BoardLoadError('notFound', ACCESS_LOST), revoked: true });
  }, []);
  useProjectAccessWatch(state.status === 'ready' ? projectId : null, markLost, poll);

  const retry = useCallback(() => {
    setState((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    load();
  }, [load]);

  /** Pull-to-refresh: the members stay while the backend is asked again. */
  const refresh = useCallback(() => {
    setState((current) => (current.status === 'ready' ? { ...current, refreshing: true } : current));
    load();
  }, [load]);

  return { state, retry, refresh };
}

/** Android's Back must not leave a screen while its change is being saved. */
export function useBackLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [locked]);
}
