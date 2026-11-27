import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { hasErrorCode } from '../api/graphql';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import { reportAccessLost } from '../data/projectAccess';
import { workloadErrorMessage, type ProjectWorkload } from '../domain/workload';

export type WorkloadState =
  | { status: 'loading' }
  /** No counts were ever loaded: nothing is shown as a count, only the error and Try again. */
  | { status: 'error'; message: string }
  /** `stale`: the last refresh failed, so these are the last counts loaded, and the screen says so. */
  | { status: 'ready'; data: ProjectWorkload; refreshing: boolean; stale: boolean }
  /** The backend refused by role (owner only). */
  | { status: 'unavailable' }
  /** The backend says the project isn't there for this user any more. */
  | { status: 'denied'; revoked: boolean };

/**
 * US-29: the project's workload from the backend's `workload` query, read again each time the
 * screen comes into view (so coming back from a task shows its new assignee or status) and on
 * pull-to-refresh. Nothing is counted from a failed answer: a first failure shows the error; a
 * failed refresh keeps the last counts, marked as not current.
 */
export function useWorkload(
  projectId: string | undefined,
  { enabled, onRoleRefused }: { enabled: boolean; onRoleRefused?: () => void },
) {
  const repository = useBoardRepository();
  const [state, setState] = useState<WorkloadState>({ status: 'loading' });
  const latest = useRef(0);
  const shown = useRef(false);
  const roleRefused = useRef(onRoleRefused);
  useEffect(() => {
    roleRefused.current = onRoleRefused;
  }, [onRoleRefused]);

  const read = useCallback(() => {
    if (!projectId || !enabled) return;
    const request = ++latest.current;
    setState((s) => (s.status === 'ready' ? { ...s, refreshing: true } : s.status === 'error' ? { status: 'loading' } : s));
    repository.getWorkload(projectId).then(
      (data) => {
        if (request !== latest.current) return;
        shown.current = true;
        setState({ status: 'ready', data, refreshing: false, stale: false });
      },
      (error: unknown) => {
        if (request !== latest.current) return;
        if (hasErrorCode(error, 'AUTH_NOT_AUTHORIZED')) {
          setState({ status: 'unavailable' });
          roleRefused.current?.();
          return;
        }
        if (hasErrorCode(error, 'NOT_FOUND')) {
          setState({ status: 'denied', revoked: shown.current });
          if (shown.current) reportAccessLost(projectId);
          return;
        }
        setState((s) =>
          s.status === 'ready'
            ? { ...s, refreshing: false, stale: true }
            : { status: 'error', message: workloadErrorMessage(error) },
        );
      },
    );
  }, [repository, projectId, enabled]);

  useFocusEffect(
    useCallback(() => {
      read();
      return () => {
        latest.current += 1;
      };
    }, [read]),
  );

  return { state, refresh: read };
}
