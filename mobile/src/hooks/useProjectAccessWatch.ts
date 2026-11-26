import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useBoardRepository } from '../data/BoardRepositoryContext';
import { onAccessLost, reportAccessLost } from '../data/projectAccess';
import { sameId } from '../domain/access';

/**
 * How often a project screen left open asks the backend whether the user is still a member. The
 * backend can't push membership changes, so this is how a removal reaches a screen nobody touches.
 * One small `projects` request per interval, only while the screen is focused and the app is in
 * the foreground.
 */
export const ACCESS_CHECK_INTERVAL_MS = 30_000;

/**
 * Calls `onLost` when access to `projectId` is lost: reported by any screen, or found by the check
 * above (`poll`). Pass `null` while the project isn't known yet.
 */
export function useProjectAccessWatch(projectId: string | null | undefined, onLost: () => void, poll = true) {
  const repository = useBoardRepository();
  const latest = useRef(onLost);
  useEffect(() => {
    latest.current = onLost;
  }, [onLost]);

  // Lost anywhere in the app: clear this screen too.
  useEffect(() => {
    if (!projectId) return;
    return onAccessLost((lostId) => {
      if (sameId(lostId, projectId)) latest.current();
    });
  }, [projectId]);

  // Left open: check now and then, only while focused and in the foreground.
  useFocusEffect(
    useCallback(() => {
      if (!projectId || !poll) return;
      let timer: ReturnType<typeof setInterval> | null = null;
      let checking = false;
      let active = true;

      const check = () => {
        if (checking) return;
        checking = true;
        repository.listProjects().then(
          (projects) => {
            checking = false;
            // `projects` lists only the user's own: missing from it means no access any more.
            if (active && !projects.some((p) => sameId(p.id, projectId))) reportAccessLost(projectId);
          },
          () => {
            // No usable answer: not a refusal. The next check, or the screen's own reads, decide.
            checking = false;
          },
        );
      };
      const start = () => {
        if (!timer) timer = setInterval(check, ACCESS_CHECK_INTERVAL_MS);
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };

      // Not while the app is known to be in the background (resuming re-checks anyway).
      const now = AppState.currentState as unknown;
      if (now !== 'background' && now !== 'inactive') start();
      const subscription = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));
      return () => {
        active = false;
        stop();
        subscription.remove();
      };
    }, [projectId, poll, repository]),
  );
}
