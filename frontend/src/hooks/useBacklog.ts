import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import type {
  BacklogItem,
  BacklogPageData,
  ColumnCategory,
  TaskPriority,
} from '../domain/models';
import { defaultProjectAccessClassifier, type ProjectAccessState } from '../domain/projectAccess';

export interface UseBacklogOptions {
  readonly projectId?: string | null;
  readonly initialPageSize?: number;
  readonly debounceMs?: number;
}

export interface UseBacklogReturn {
  readonly data: BacklogPageData | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly accessState: ProjectAccessState;
  readonly search: string;
  readonly statusFilter: ColumnCategory | null;
  readonly priorityFilter: TaskPriority | 'NONE' | null;
  readonly page: number;
  readonly pageSize: number;
  readonly isSavingOrder: boolean;
  readonly isSavingPriority: boolean;
  readonly orderSavedBanner: boolean;
  readonly prioritySavedBanner: string | null;
  readonly reorderError: string | null;
  readonly priorityError: string | null;
  readonly canReorder: boolean;
  readonly setSearch: (query: string) => void;
  readonly setStatusFilter: (status: ColumnCategory | null) => void;
  readonly setPriorityFilter: (priority: TaskPriority | 'NONE' | null) => void;
  readonly setPage: (newPage: number) => void;
  readonly reload: () => void;
  readonly handleRankTask: (taskId: string, afterTaskId: string | null, targetIndex: number) => Promise<boolean>;
  readonly handleMoveUp: (item: BacklogItem) => Promise<boolean>;
  readonly handleMoveDown: (item: BacklogItem) => Promise<boolean>;
  readonly handleMoveToPosition: (item: BacklogItem, newPosition1Based: number) => Promise<boolean>;
  readonly handleUpdatePriority: (taskId: string, priority: TaskPriority | null) => Promise<boolean>;
  readonly dismissOrderSavedBanner: () => void;
  readonly dismissPrioritySavedBanner: () => void;
  readonly dismissReorderError: () => void;
  readonly dismissPriorityError: () => void;
}

export function useBacklog({
  projectId,
  initialPageSize = 20,
  debounceMs = 250,
}: UseBacklogOptions): UseBacklogReturn {
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilterState] = useState<ColumnCategory | null>(null);
  const [priorityFilter, setPriorityFilterState] = useState<TaskPriority | 'NONE' | null>(null);
  const [page, setPageState] = useState(1);
  const [pageSize] = useState(initialPageSize);

  const [data, setData] = useState<BacklogPageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessState, setAccessState] = useState<ProjectAccessState>('permitted');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isSavingPriority, setIsSavingPriority] = useState(false);
  const [orderSavedBanner, setOrderSavedBanner] = useState(false);
  const [prioritySavedBanner, setPrioritySavedBanner] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prioritySavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  const canReorder = useMemo(() => {
    return !search.trim() && !debouncedSearch.trim() && statusFilter === null && priorityFilter === null && page === 1;
  }, [search, debouncedSearch, statusFilter, priorityFilter, page]);

  // Debounce search input
  const setSearch = useCallback(
    (query: string) => {
      setSearchState(query);
      setPageState(1);

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        setDebouncedSearch(query);
      }, debounceMs);
    },
    [debounceMs]
  );

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const setStatusFilter = useCallback((status: ColumnCategory | null) => {
    setStatusFilterState(status);
    setPageState(1);
  }, []);

  const setPriorityFilter = useCallback((priority: TaskPriority | 'NONE' | null) => {
    setPriorityFilterState(priority);
    setPageState(1);
  }, []);

  const setPage = useCallback((newPage: number) => {
    if (newPage < 1) return;
    setPageState(newPage);
  }, []);

  const reload = useCallback(() => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!projectId) {
      return;
    }

    const fetchBacklog = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const where = api.backlog.buildFilter(statusFilter, priorityFilter);
        const result = await api.backlog.getBacklog({
          projectId,
          search: debouncedSearch,
          where,
          page,
          pageSize,
        });

        if (!isCancelled) {
          hasLoadedRef.current = true;
          setData(result);
          setAccessState('permitted');
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const wasPermitted = hasLoadedRef.current;
          const classified = defaultProjectAccessClassifier.classifyError(err, wasPermitted);
          if (classified === 'unavailable' || classified === 'revoked' || classified === 'session_expired') {
            hasLoadedRef.current = false;
            setAccessState(classified);
            setData(null);
          }
          const message =
            err instanceof Error && err.message
              ? err.message
              : 'Couldn’t load the backlog';
          setError(message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchBacklog();

    return () => {
      isCancelled = true;
    };
  }, [projectId, debouncedSearch, statusFilter, priorityFilter, page, pageSize, reloadTrigger]);

  const dismissOrderSavedBanner = useCallback(() => {
    setOrderSavedBanner(false);
  }, []);

  const dismissPrioritySavedBanner = useCallback(() => {
    setPrioritySavedBanner(null);
  }, []);

  const dismissReorderError = useCallback(() => {
    setReorderError(null);
  }, []);

  const dismissPriorityError = useCallback(() => {
    setPriorityError(null);
  }, []);

  const handleRankTask = useCallback(
    async (taskId: string, afterTaskId: string | null, targetIndex: number): Promise<boolean> => {
      if (!data) return false;
      const previousData = data;
      const currentItems = [...data.items];
      const currentIndex = currentItems.findIndex((i) => i.id === taskId);
      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= currentItems.length) {
        return false;
      }
      if (currentIndex === targetIndex) {
        return true;
      }

      // Optimistic update
      const [movedItem] = currentItems.splice(currentIndex, 1);
      currentItems.splice(targetIndex, 0, movedItem);

      setData({
        ...previousData,
        items: currentItems,
      });
      setIsSavingOrder(true);
      setOrderSavedBanner(false);
      setReorderError(null);

      try {
        await api.backlog.rankTask({
          taskId,
          afterTaskId: afterTaskId ?? undefined,
        });
        setIsSavingOrder(false);
        setOrderSavedBanner(true);

        if (orderSavedTimeoutRef.current) {
          clearTimeout(orderSavedTimeoutRef.current);
        }
        orderSavedTimeoutRef.current = setTimeout(() => {
          setOrderSavedBanner(false);
        }, 4000);

        return true;
      } catch (err: unknown) {
        // Rollback
        setData(previousData);
        setIsSavingOrder(false);
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Couldn't save order. Changes were rolled back.";
        setReorderError(message);
        return false;
      }
    },
    [data]
  );

  const handleMoveUp = useCallback(
    async (item: BacklogItem): Promise<boolean> => {
      if (!data || !canReorder) return false;
      const currentIndex = data.items.findIndex((i) => i.id === item.id);
      if (currentIndex <= 0) return false;
      const targetIndex = currentIndex - 1;
      const remaining = data.items.filter((i) => i.id !== item.id);
      const afterTaskId = targetIndex === 0 ? null : remaining[targetIndex - 1].id;
      return handleRankTask(item.id, afterTaskId, targetIndex);
    },
    [data, canReorder, handleRankTask]
  );

  const handleMoveDown = useCallback(
    async (item: BacklogItem): Promise<boolean> => {
      if (!data || !canReorder) return false;
      const currentIndex = data.items.findIndex((i) => i.id === item.id);
      if (currentIndex === -1 || currentIndex >= data.items.length - 1) return false;
      const targetIndex = currentIndex + 1;
      const remaining = data.items.filter((i) => i.id !== item.id);
      const afterTaskId = targetIndex === 0 ? null : remaining[targetIndex - 1].id;
      return handleRankTask(item.id, afterTaskId, targetIndex);
    },
    [data, canReorder, handleRankTask]
  );

  const handleMoveToPosition = useCallback(
    async (item: BacklogItem, newPosition1Based: number): Promise<boolean> => {
      if (!data || !canReorder) return false;
      const targetIndex = newPosition1Based - 1;
      if (targetIndex < 0 || targetIndex >= data.items.length) return false;
      const currentIndex = data.items.findIndex((i) => i.id === item.id);
      if (currentIndex === targetIndex) return true;
      const remaining = data.items.filter((i) => i.id !== item.id);
      const afterTaskId = targetIndex === 0 ? null : remaining[targetIndex - 1].id;
      return handleRankTask(item.id, afterTaskId, targetIndex);
    },
    [data, canReorder, handleRankTask]
  );

  const handleUpdatePriority = useCallback(
    async (taskId: string, priority: TaskPriority | null): Promise<boolean> => {
      if (!data) return false;
      const previousData = data;
      const currentItems = data.items.map((i) =>
        i.id === taskId ? { ...i, priority } : i
      );

      setData({
        ...previousData,
        items: currentItems,
      });
      setIsSavingPriority(true);
      setPrioritySavedBanner(null);
      setPriorityError(null);

      try {
        await api.backlog.updateTaskPriority(taskId, priority);
        setIsSavingPriority(false);

        const priorityLabel =
          priority === 'CRITICAL'
            ? 'Critical'
            : priority === 'HIGH'
            ? 'High'
            : priority === 'MEDIUM'
            ? 'Medium'
            : priority === 'LOW'
            ? 'Low'
            : 'No priority';

        setPrioritySavedBanner(priorityLabel);

        if (prioritySavedTimeoutRef.current) {
          clearTimeout(prioritySavedTimeoutRef.current);
        }
        prioritySavedTimeoutRef.current = setTimeout(() => {
          setPrioritySavedBanner(null);
        }, 4000);

        return true;
      } catch (err: unknown) {
        setData(previousData);
        setIsSavingPriority(false);
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Couldn't update priority. Changes were rolled back.";
        setPriorityError(message);
        return false;
      }
    },
    [data]
  );

  useEffect(() => {
    return () => {
      if (orderSavedTimeoutRef.current) {
        clearTimeout(orderSavedTimeoutRef.current);
      }
      if (prioritySavedTimeoutRef.current) {
        clearTimeout(prioritySavedTimeoutRef.current);
      }
    };
  }, []);

  return {
    data: projectId ? data : null,
    isLoading: projectId ? isLoading : false,
    error: projectId ? error : null,
    accessState,
    search,
    statusFilter,
    priorityFilter,
    page,
    pageSize,
    isSavingOrder,
    isSavingPriority,
    orderSavedBanner,
    prioritySavedBanner,
    reorderError,
    priorityError,
    canReorder,
    setSearch,
    setStatusFilter,
    setPriorityFilter,
    setPage,
    reload,
    handleRankTask,
    handleMoveUp,
    handleMoveDown,
    handleMoveToPosition,
    handleUpdatePriority,
    dismissOrderSavedBanner,
    dismissPrioritySavedBanner,
    dismissReorderError,
    dismissPriorityError,
  };
}
