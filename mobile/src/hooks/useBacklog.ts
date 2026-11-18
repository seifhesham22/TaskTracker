import { useCallback, useEffect, useRef, useState } from 'react';

import { useBoardRepository } from '../data/BoardRepositoryContext';
import {
  EMPTY_QUERY,
  LOAD_MORE_FAILED,
  appendPage,
  backlogErrorMessage,
  type BacklogItem,
  type BacklogQuery,
} from '../domain/backlog';
import type { ColumnCategory, TaskPriority } from '../domain/models';

export const SEARCH_DELAY_MS = 350;

export type BacklogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      items: BacklogItem[];
      totalCount: number;
      page: number;
      hasNextPage: boolean;
      loadingMore: boolean;
      moreError: string | null;
    };

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * The project's backlog as the backend returns it. Search, filters and paging are all sent to
 * the backend; the app only keeps the pages it got, in order. A new search or filter starts again
 * from page 1, and an answer to an older query is ignored.
 */
export function useBacklog(projectId: string | undefined) {
  const repository = useBoardRepository();
  const [query, setQuery] = useState<BacklogQuery>(EMPTY_QUERY);
  const [searchText, setSearchText] = useState('');
  const [state, setState] = useState<BacklogState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  // Bumped for every new query; an answer carrying an older number is dropped.
  const generation = useRef(0);

  // Page 1 of the current query. The handlers that change the query show the loading state.
  useEffect(() => {
    const current = ++generation.current;
    if (!projectId) return;
    repository.getBacklog(projectId, query, 1).then(
      (result) => {
        if (current !== generation.current) return;
        setState({ status: 'ready', ...result, loadingMore: false, moreError: null });
      },
      (error: unknown) => {
        if (current !== generation.current) return;
        setState({ status: 'error', message: backlogErrorMessage(error) });
      },
    );
  }, [repository, projectId, query, reloadKey]);

  // The search goes to the backend once typing pauses.
  useEffect(() => {
    if (searchText.trim() === query.search.trim()) return;
    const timer = setTimeout(() => {
      setState({ status: 'loading' });
      setQuery((q) => ({ ...q, search: searchText }));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText, query.search]);

  const changeQuery = useCallback((change: (q: BacklogQuery) => BacklogQuery) => {
    setState({ status: 'loading' });
    setQuery(change);
  }, []);

  const toggleStatus = (status: ColumnCategory) => changeQuery((q) => ({ ...q, statuses: toggle(q.statuses, status) }));
  const togglePriority = (priority: TaskPriority) =>
    changeQuery((q) => ({ ...q, priorities: toggle(q.priorities, priority) }));
  const clearFilters = () => changeQuery((q) => ({ ...q, statuses: [], priorities: [] }));
  const clearAll = () => {
    setSearchText('');
    changeQuery(() => EMPTY_QUERY);
  };

  const retry = () => {
    setState({ status: 'loading' });
    setReloadKey((k) => k + 1);
  };

  // The next page of the same query, added after the items shown.
  const loadMore = async () => {
    if (!projectId || state.status !== 'ready' || !state.hasNextPage || state.loadingMore) return;
    const current = generation.current;
    const next = state.page + 1;
    setState({ ...state, loadingMore: true, moreError: null });
    try {
      const result = await repository.getBacklog(projectId, query, next);
      if (current !== generation.current) return;
      setState((s) =>
        s.status === 'ready'
          ? {
              ...s,
              items: appendPage(s.items, result.items),
              totalCount: result.totalCount,
              page: result.page,
              hasNextPage: result.hasNextPage,
              loadingMore: false,
            }
          : s,
      );
    } catch {
      if (current !== generation.current) return;
      // Keep what is already shown; the same page can be asked for again.
      setState((s) => (s.status === 'ready' ? { ...s, loadingMore: false, moreError: LOAD_MORE_FAILED } : s));
    }
  };

  return {
    state,
    query,
    searchText,
    setSearchText,
    toggleStatus,
    togglePriority,
    clearFilters,
    clearAll,
    retry,
    loadMore: () => {
      void loadMore();
    },
  };
}
