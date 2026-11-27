import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useBoardRepository } from '../data/BoardRepositoryContext';
import type { Task } from '../domain/models';
import { CLEARED, NO_FILTERS, boardTasksVariables, taskSearchErrorMessage, type TaskFilters } from '../domain/taskFilters';
import { SEARCH_DELAY_MS } from './useBacklog';

export type BoardTasksState =
  | { status: 'loading' }
  /** No results were loaded for these criteria; the criteria stay as they are. */
  | { status: 'error'; message: string }
  /** `stale`: a refresh failed, so these are the last results loaded for the same criteria. */
  | { status: 'ready'; tasks: Task[]; refreshing: boolean; stale: boolean };

/**
 * US-36: a board's tasks with a title search and filters, all applied by the backend's `tasks`
 * query (search and filters together, AND). Like the backlog (US-23): the search is sent once
 * typing pauses, any change asks again from the start, and only the newest answer is shown.
 * The list is the backend's whole answer for the board, so there are no pages to reset.
 */
export function useBoardTaskSearch(boardId: string | undefined) {
  const repository = useBoardRepository();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const [state, setState] = useState<BoardTasksState>({ status: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);
  /** A refresh keeps the list on screen until the answer comes. */
  const quiet = useRef(false);

  useEffect(() => {
    if (!boardId) return;
    const current = ++generation.current;
    const isRefresh = quiet.current;
    quiet.current = false;
    repository.searchBoardTasks(boardTasksVariables(boardId, search, filters)).then(
      (tasks) => {
        if (current !== generation.current) return;
        setState({ status: 'ready', tasks, refreshing: false, stale: false });
      },
      (error: unknown) => {
        if (current !== generation.current) return;
        setState((s) =>
          isRefresh && s.status === 'ready'
            ? { ...s, refreshing: false, stale: true }
            : { status: 'error', message: taskSearchErrorMessage(error) },
        );
      },
    );
  }, [repository, boardId, search, filters, reloadKey]);

  // The search goes to the backend once typing pauses.
  useEffect(() => {
    if (searchText.trim() === search.trim()) return;
    const timer = setTimeout(() => {
      setNotice(null);
      setState({ status: 'loading' });
      setSearch(searchText);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText, search]);

  /** Pull-to-refresh, and coming back from a task: the same criteria, the list kept meanwhile. */
  const refresh = useCallback(() => {
    quiet.current = true;
    setState((s) => (s.status === 'ready' ? { ...s, refreshing: true } : s));
    setReloadKey((k) => k + 1);
  }, []);

  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) refresh();
      focusedBefore.current = true;
    }, [refresh]),
  );

  const applyFilters = (next: TaskFilters) => {
    setNotice(null);
    setState({ status: 'loading' });
    setFilters(next);
  };

  /** Removes every criterion and reads the board's full list again from the backend. */
  const clearAll = () => {
    setSearchText('');
    setSearch('');
    setFilters(NO_FILTERS);
    setState({ status: 'loading' });
    setReloadKey((k) => k + 1);
    setNotice(CLEARED);
  };

  const retry = () => {
    setState({ status: 'loading' });
    setReloadKey((k) => k + 1);
  };

  return { state, searchText, setSearchText, search, filters, applyFilters, clearAll, retry, refresh, notice };
}
