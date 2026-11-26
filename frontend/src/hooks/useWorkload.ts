import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import type { MemberWorkloadItem, ProjectWorkloadData } from '../domain/models';

export type WorkloadViewMode = 'overview' | 'member_drilldown' | 'unassigned_drilldown';

export interface UseWorkloadOptions {
  readonly projectId?: string | null;
}

export interface UseWorkloadReturn {
  readonly data: ProjectWorkloadData | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly accessRestricted: boolean;
  readonly viewMode: WorkloadViewMode;
  readonly selectedMember: MemberWorkloadItem | null;
  readonly reload: () => void;
  readonly selectMember: (userId: string) => void;
  readonly selectUnassigned: () => void;
  readonly backToOverview: () => void;
}

export function useWorkload({ projectId }: UseWorkloadOptions): UseWorkloadReturn {
  const [data, setData] = useState<ProjectWorkloadData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessRestricted, setAccessRestricted] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [viewMode, setViewMode] = useState<WorkloadViewMode>('overview');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  const selectMember = useCallback((userId: string) => {
    setSelectedMemberId(userId);
    setViewMode('member_drilldown');
  }, []);

  const selectUnassigned = useCallback(() => {
    setSelectedMemberId(null);
    setViewMode('unassigned_drilldown');
  }, []);

  const backToOverview = useCallback(() => {
    setSelectedMemberId(null);
    setViewMode('overview');
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!projectId) {
      return;
    }

    const fetchWorkload = async () => {
      setIsLoading(true);
      setError(null);
      setAccessRestricted(false);

      try {
        const result = await api.workload.getWorkload(projectId);
        if (!isCancelled) {
          setData(result);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          if (err instanceof ApiError && (err.status === 403 || err.message.toLowerCase().includes('owner'))) {
            setAccessRestricted(true);
            setData(null);
          } else {
            const message =
              err instanceof Error && err.message
                ? err.message
                : 'Couldn’t load workload. Try again.';
            setError(message);
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchWorkload();

    return () => {
      isCancelled = true;
    };
  }, [projectId, reloadTrigger]);

  const selectedMember = useMemo(() => {
    if (!data || !selectedMemberId) return null;
    return data.members.find((m) => m.userId === selectedMemberId) || null;
  }, [data, selectedMemberId]);

  return {
    data: projectId ? data : null,
    isLoading: projectId ? isLoading : false,
    error: projectId ? error : null,
    accessRestricted,
    viewMode,
    selectedMember,
    reload,
    selectMember,
    selectUnassigned,
    backToOverview,
  };
}
