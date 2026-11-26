import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import type { ProjectMembers } from '../domain/members';

export type ProjectMembersState =
  | { status: 'loading' }
  | { status: 'ready'; project: ProjectMembers; refreshFailed: boolean }
  | { status: 'error'; notFound: boolean; message: string };

/** The project's members, read from the backend each time the screen comes into view. */
export function useProjectMembers(projectId: string | undefined) {
  const repository = useBoardRepository();
  const [state, setState] = useState<ProjectMembersState>({ status: 'loading' });
  const latest = useRef(0);

  const load = useCallback(() => {
    const request = ++latest.current;
    repository.getProjectMembers(projectId ?? '').then(
      (project) => {
        if (request === latest.current) setState({ status: 'ready', project, refreshFailed: false });
      },
      (error: unknown) => {
        if (request !== latest.current) return;
        const notFound = error instanceof BoardLoadError && error.kind === 'notFound';
        const message = error instanceof BoardLoadError ? error.message : 'Something went wrong.';
        // A failed refresh keeps the members already shown; losing access to the project doesn't.
        setState((current) =>
          current.status === 'ready' && !notFound
            ? { ...current, refreshFailed: true }
            : { status: 'error', notFound, message },
        );
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

  const retry = useCallback(() => {
    setState((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    load();
  }, [load]);

  return { state, retry };
}

/** Android's Back must not leave a screen while its change is being saved. */
export function useBackLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [locked]);
}
