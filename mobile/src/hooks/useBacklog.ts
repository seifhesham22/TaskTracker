import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useBoardRepository } from '../data/BoardRepositoryContext';
import {
  EMPTY_QUERY,
  LOAD_MORE_FAILED,
  ORDER_CHANGED,
  ORDER_SAVED,
  ORDER_SAVED_NOT_RELOADED,
  SAVE_FAILED,
  anchorPosition,
  appendPage,
  backlogErrorMessage,
  backlogSaveErrorMessage,
  isFiltered,
  isRoleRefusal,
  isStaleOrder,
  moveItem,
  priorityUpdated,
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

/** The note above the list after a change: what the backend confirmed, or why it refused. */
export interface BacklogNotice {
  tone: 'success' | 'error';
  text: string;
  detail?: string;
}

/** A change waiting for the backend. While one runs, no other can start. */
export type BacklogPending = 'order' | 'priority' | null;

/** The order changed on the server between reading the neighbour and saving. */
class StaleOrderError extends Error {}

const announce = (text: string) => {
  AccessibilityInfo.announceForAccessibility?.(text);
};

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * The project's backlog as the backend returns it. Search, filters and paging are all sent to
 * the backend; the app only keeps the pages it got, in order. A new search or filter starts again
 * from page 1, and an answer to an older query is ignored.
 *
 * US-24: writers and owners change an item's priority (`updateTask`) and its place in the backlog
 * (`rankTask`). Nothing is shown as saved before the backend confirms it, and the list shown
 * afterwards is the one the backend returns.
 */
export function useBacklog(
  projectId: string | undefined,
  {
    onRoleRefused,
  }: {
    /** The backend refused a change because of the user's role: the screen reads it again. */
    onRoleRefused?: () => void;
  } = {},
) {
  const repository = useBoardRepository();
  const [query, setQuery] = useState<BacklogQuery>(EMPTY_QUERY);
  const [searchText, setSearchText] = useState('');
  const [state, setState] = useState<BacklogState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<BacklogPending>(null);
  const [notice, setNotice] = useState<BacklogNotice | null>(null);
  /** Set at once, so a second tap in the same render can't start a second save. */
  const busy = useRef(false);
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
      setNotice(null);
      setState({ status: 'loading' });
      setQuery((q) => ({ ...q, search: searchText }));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText, query.search]);

  const changeQuery = useCallback((change: (q: BacklogQuery) => BacklogQuery) => {
    setNotice(null);
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
    if (!projectId || state.status !== 'ready' || !state.hasNextPage || state.loadingMore || busy.current) return;
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

  /**
   * Reads every page shown so far again, in the backend's order, so the list is exactly what the
   * server saved: what any other member gets from a fresh `backlog`. Answers to an older query are
   * dropped, and so is the reload itself when the query changed since `since`. Rejects if a page
   * can't be read; the list shown is then left as it was.
   */
  const reloadShown = async (pages: number, since: number) => {
    if (!projectId || since !== generation.current) return;
    const current = ++generation.current;
    let last = await repository.getBacklog(projectId, query, 1);
    let items = appendPage([], last.items);
    for (let next = 2; next <= pages && last.hasNextPage; next++) {
      last = await repository.getBacklog(projectId, query, next);
      items = appendPage(items, last.items);
    }
    if (current !== generation.current) return;
    setState({
      status: 'ready',
      items,
      totalCount: last.totalCount,
      page: last.page,
      hasNextPage: last.hasNextPage,
      loadingMore: false,
      moreError: null,
    });
  };

  const finish = () => {
    busy.current = false;
    setPending(null);
  };

  /**
   * US-24: moves the item to `target`, its 1-based place in the full backlog. Only the unfiltered
   * list is numbered like the backlog (pages are added from page 1, so the n-th row is the n-th
   * item), so this does nothing while a search or filter is on.
   *
   * The backend takes “after this task”: the neighbour is taken from the loaded rows, or read from
   * the backend's own order when it's further down than what's loaded. The moved row is shown at
   * its new place only while the save runs; then the shown pages are read again. If the backend
   * refuses, the previous order comes back.
   */
  const reorder = async (itemId: string, target: number) => {
    if (!projectId || state.status !== 'ready' || busy.current || state.loadingMore || isFiltered(query)) return;
    const saved = state;
    const from = saved.items.findIndex((i) => i.id === itemId) + 1;
    if (from === 0 || target === from || target < 1 || target > saved.totalCount) return;

    busy.current = true;
    setPending('order');
    setNotice(null);
    const current = generation.current;
    if (target <= saved.items.length) setState({ ...saved, items: moveItem(saved.items, from - 1, target - 1) });

    try {
      const place = anchorPosition(from, target);
      let afterTaskId: string | null = null;
      if (place > 0) {
        const anchor =
          place <= saved.items.length ? saved.items[place - 1] : await repository.getBacklogItemAt(projectId, place);
        if (!anchor || anchor.id === itemId) throw new StaleOrderError();
        afterTaskId = anchor.id;
      }
      await repository.rankTask(itemId, afterTaskId);
    } catch (error) {
      // Nothing was saved: the order the backend has is the one shown before.
      if (current === generation.current) setState(saved);
      const stale = error instanceof StaleOrderError || isStaleOrder(error);
      const detail = stale ? ORDER_CHANGED : backlogSaveErrorMessage(error);
      setNotice({ tone: 'error', text: SAVE_FAILED, detail });
      announce(`${SAVE_FAILED} ${detail}`);
      if (isRoleRefusal(error)) onRoleRefused?.();
      if (stale) await reloadShown(saved.page, current).catch(() => undefined);
      finish();
      return;
    }

    // Saved. What's shown now comes from the backend, not from the preview.
    try {
      await reloadShown(saved.page, current);
      setNotice({ tone: 'success', text: ORDER_SAVED });
      announce(ORDER_SAVED);
    } catch {
      setNotice({ tone: 'success', text: ORDER_SAVED_NOT_RELOADED });
      announce(ORDER_SAVED_NOT_RELOADED);
    } finally {
      finish();
    }
  };

  /**
   * US-24: saves the item's priority with the backend's `updateTask` (only `priority` is sent).
   * The row shows the value the backend returns; then the shown pages are read again, since a
   * priority filter may now leave the item out. The order doesn't change. Resolves to null when
   * saved, or to the reason it wasn't: the row then keeps its saved priority.
   */
  const changePriority = async (itemId: string, priority: TaskPriority | null): Promise<string | null> => {
    if (!projectId || state.status !== 'ready' || busy.current) return null;
    busy.current = true;
    setPending('priority');
    setNotice(null);
    const pages = state.page;
    const current = generation.current;
    let saved: TaskPriority | null;
    try {
      saved = (await repository.updateTask(itemId, { priority })).priority;
    } catch (error) {
      if (isRoleRefusal(error)) onRoleRefused?.();
      const message = backlogSaveErrorMessage(error);
      announce(`Couldn’t update the priority. ${message}`);
      finish();
      return message;
    }
    setState((s) =>
      s.status === 'ready' ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, priority: saved } : i)) } : s,
    );
    setNotice({ tone: 'success', text: priorityUpdated(saved) });
    announce(priorityUpdated(saved));
    finish();
    // The row already shows the saved value; if this read fails, pull-to-refresh reads it again.
    void reloadShown(pages, current).catch(() => undefined);
    return null;
  };

  return {
    state,
    query,
    pending,
    notice,
    dismissNotice: () => setNotice(null),
    reorder: (itemId: string, target: number) => {
      void reorder(itemId, target);
    },
    changePriority,
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
