import { useCallback, useEffect, useState } from 'react';
import { api, type ApiStatus } from '../api';
import type { SystemService } from '../api/services/SystemService';

export type ApiStatusState = ApiStatus | 'checking';

/** Loads the backend status once on mount and exposes a manual refresh. */
export function useApiStatus(service: SystemService = api.system) {
  const [status, setStatus] = useState<ApiStatusState>('checking');

  useEffect(() => {
    let active = true;
    service.checkStatus().then((result) => {
      if (active) {
        setStatus(result);
      }
    });
    return () => {
      active = false;
    };
  }, [service]);

  const refresh = useCallback(async () => {
    setStatus('checking');
    setStatus(await service.checkStatus());
  }, [service]);

  return { status, refresh };
}
