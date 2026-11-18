import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { BoardLoadError } from '../data/BoardRepository';
import { useBoardRepository } from '../data/BoardRepositoryContext';
import type { TaskDetails } from '../domain/models';

export type TaskDetailsState =
  | { status: 'loading' }
  | { status: 'ready'; details: TaskDetails }
  | { status: 'error'; error: BoardLoadError };

/**
 * Reads the task from the backend each time its screen comes into view, so returning from the
 * Edit task screen shows what the backend saved, not what the form sent.
 */
export function useTaskDetails(boardId: string | undefined, taskId: string | undefined) {
  const repository = useBoardRepository();
  const [state, setState] = useState<TaskDetailsState>({ status: 'loading' });
  const latest = useRef(0);

  const load = useCallback(() => {
    const request = ++latest.current;
    if (!boardId || !taskId) {
      setState({ status: 'error', error: new BoardLoadError('notFound', 'This link doesn’t point to a task.') });
      return;
    }
    repository.getTask(boardId, taskId).then(
      (details) => {
        if (request === latest.current) setState({ status: 'ready', details });
      },
      (error: unknown) => {
        if (request !== latest.current) return;
        // Keep showing the task if a background reload fails; only a missing task replaces it.
        const loadError =
          error instanceof BoardLoadError
            ? error
            : new BoardLoadError('server', error instanceof Error ? error.message : 'Something went wrong.');
        setState((current) =>
          current.status === 'ready' && loadError.kind !== 'notFound' ? current : { status: 'error', error: loadError },
        );
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

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    load();
  }, [load]);

  /** Reads the task again without showing the loading state. */
  const reload = load;

  return { state, retry, reload };
}
