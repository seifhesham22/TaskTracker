import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { reportAccessConfirmed, reportAccessLost } from '../data/projectAccess';
import { accessProblemOf, type AccessDenial } from '../domain/access';
import { useForegroundRefresh } from './useForegroundRefresh';
import { useProjectAccessWatch } from './useProjectAccessWatch';

export type AccessCheckedState<T> =
  | { status: 'checking' }
  | { status: 'ready'; data: T; refreshing: boolean }
  | { status: 'denied'; denial: AccessDenial }
  /** No usable answer; `error` says whether it was the connection, the server or the app's setup. */
  | { status: 'unverified'; error: unknown };

/**
 * One project's data, read from the backend each time the screen comes into view, when the app
 * comes back to the foreground, on pull-to-refresh, and checked now and then while left open, so
 * membership is never taken from what was shown before.
 *
 * Until the first answer nothing is shown (`checking`). A refusal replaces the data, whatever was
 * shown: `revoked` if the user was looking at it, `unavailable` otherwise, and every other open
 * screen of the project is cleared too. A failure without an answer is `unverified` at first; once
 * the data was shown, it stays and the next read tries again.
 */
export function useAccessCheckedLoad<T>(
  projectId: string | undefined,
  load: () => Promise<T>,
  /** `poll: false` for forms: no periodic check, so nobody's typing is replaced while they work. */
  { poll = true }: { poll?: boolean } = {},
) {
  const [state, setState] = useState<AccessCheckedState<T>>({ status: 'checking' });
  const latest = useRef(0);
  /** Whether the project's data has been on screen, so a refusal is “access changed”. */
  const shown = useRef(false);

  const read = useCallback(() => {
    const request = ++latest.current;
    load().then(
      (data) => {
        if (request !== latest.current) return;
        if (projectId) reportAccessConfirmed(projectId);
        shown.current = true;
        setState({ status: 'ready', data, refreshing: false });
      },
      (error: unknown) => {
        if (request !== latest.current) return;
        const problem = accessProblemOf(error);
        if (problem === 'denied') {
          setState({ status: 'denied', denial: shown.current ? 'revoked' : 'unavailable' });
          if (shown.current && projectId) reportAccessLost(projectId);
          return;
        }
        // An expired session is signing the user out: show nothing meanwhile.
        if (problem === 'expired') {
          setState({ status: 'checking' });
          return;
        }
        setState((current) =>
          current.status === 'ready'
            ? { ...current, refreshing: false }
            : current.status === 'denied'
              ? current
              : { status: 'unverified', error },
        );
      },
    );
  }, [load, projectId]);

  useFocusEffect(
    useCallback(() => {
      read();
      return () => {
        latest.current += 1;
      };
    }, [read]),
  );
  useForegroundRefresh(read);

  // Lost anywhere, or found by the check while the screen is left open: clear the data at once.
  const markLost = useCallback(() => {
    latest.current += 1;
    shown.current = true;
    setState({ status: 'denied', denial: 'revoked' });
  }, []);
  useProjectAccessWatch(state.status === 'ready' ? projectId : null, markLost, poll);

  const retry = useCallback(() => {
    setState({ status: 'checking' });
    read();
  }, [read]);

  /** Pull-to-refresh: the data stays while the backend is asked again. */
  const refresh = useCallback(() => {
    setState((current) => (current.status === 'ready' ? { ...current, refreshing: true } : current));
    read();
  }, [read]);

  return { state, retry, refresh, reload: read };
}
