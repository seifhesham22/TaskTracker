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
import { accessProblemOf } from '../domain/access';
import type { ColumnCategory, TaskPriority } from '../domain/models';
import { reportAccessLost } from '../data/projectAccess';

export const SEARCH_DELAY_MS = 350;

export type BacklogState =
  | { status: 'loading' }
  /** `denied`: the backend refused (not a member); `revoked`: it refused while the list was shown. */
  | { status: 'error'; message: string; denied: boolean; revoked: boolean }
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
  /** Pull-to-refresh: the list stays while page 1 is read again, unless the backend refuses. */
  const quiet = useRef(false);
  /** Whether the list has been on screen, so a refusal is “access changed”. */
  const shown = useRef(false);

  // Page 1 of the current query. The handlers that change the query show the loading state.
  useEffect(() => {
    const current = ++generation.current;
    const isRefresh = quiet.current;
    quiet.current = false;
    if (!projectId) return;
    repository.getBacklog(projectId, query, 1).then(
      (result) => {
        if (current !== generation.current) return;
        shown.current = true;
        setState({ status: 'ready', ...result, loadingMore: false, moreError: null });
      },
      (error: unknown) => {
        if (current !== generation.current) return;
        const denied = accessProblemOf(error) === 'denied';
        setState((s) =>
          isRefresh && !denied && s.status === 'ready'
            ? s
            : { status: 'error', message: backlogErrorMessage(error), denied, revoked: denied && shown.current },
        );
        // Refused after it was shown: every open screen of the project clears, not only this one.
        if (denied && shown.current) reportAccessLost(projectId);
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
    } catch (error) {
      if (current !== generation.current) return;
      if (accessProblemOf(error) === 'denied') {
        // Access was lost while the list was shown: nothing of it may stay, here or elsewhere.
        setState({ status: 'error', message: backlogErrorMessage(error), denied: true, revoked: true });
        reportAccessLost(projectId);
        return;
      }
      // Keep what is already shown; the same page can be asked for again.
      setState((s) => (s.status === 'ready' ? { ...s, loadingMore: false, moreError: LOAD_MORE_FAILED } : s));
    }
  };

  // Coming back from the background re-checks the project's membership on the screen around this
  // list (useAccessCheckedLoad), so the list doesn't ask the backend a second time.

  /** Pull-to-refresh: page 1 of the same query, read again without the loading state. */
  const refresh = () => {
    quiet.current = true;
    setReloadKey((k) => k + 1);
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
    refresh,
    loadMore: () => {
      void loadMore();
    },
  };
}
