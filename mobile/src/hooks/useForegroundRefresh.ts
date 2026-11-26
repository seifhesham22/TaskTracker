import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Calls `refresh` each time the app comes back to the foreground, so a screen asks the backend
 * again instead of trusting what it showed before: membership may have changed in the meantime.
 */
export function useForegroundRefresh(refresh: () => void) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let previous: string | null | undefined = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (previous !== 'active' && next === 'active') latest.current();
      previous = next;
    });
    return () => subscription.remove();
  }, []);
}
