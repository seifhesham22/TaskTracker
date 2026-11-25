import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type {
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
  readonly setSearch: (query: string) => void;
  readonly setStatusFilter: (status: ColumnCategory | null) => void;
  readonly setPriorityFilter: (priority: TaskPriority | 'NONE' | null) => void;
  readonly setPage: (newPage: number) => void;
  readonly reload: () => void;
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

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

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
    setSearch,
    setStatusFilter,
    setPriorityFilter,
    setPage,
    reload,
  };
}
