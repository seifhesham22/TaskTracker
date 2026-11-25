import { createContext, useContext } from 'react';

const STORAGE_PROJECT_KEY = 'tasktracker_active_project_id';
const STORAGE_BOARD_KEY = 'tasktracker_active_board_id';
const STORAGE_NAME_KEY = 'tasktracker_active_project_name';

export class ActiveProjectStorage {
  public static loadSavedProjectId(): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(STORAGE_PROJECT_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    return null;
  }

  public static loadSavedBoardId(): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(STORAGE_BOARD_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    return null;
  }

  public static loadSavedProjectName(): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(STORAGE_NAME_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    return null;
  }

  public static saveActiveState(
    projectId: string | null,
    boardId: string | null,
    projectName: string | null = null
  ): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (projectId) {
          window.localStorage.setItem(STORAGE_PROJECT_KEY, projectId);
        }
        if (boardId) {
          window.localStorage.setItem(STORAGE_BOARD_KEY, boardId);
        }
        if (projectName) {
          window.localStorage.setItem(STORAGE_NAME_KEY, projectName);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  public static clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_PROJECT_KEY);
        window.localStorage.removeItem(STORAGE_BOARD_KEY);
        window.localStorage.removeItem(STORAGE_NAME_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }
}

export interface ActiveProjectState {
  readonly activeProjectId: string | null;
  readonly activeBoardId: string | null;
  readonly activeProjectName: string | null;
  readonly setActiveProject: (
    projectId: string,
    boardId?: string | null,
    projectName?: string | null
  ) => void;
  readonly setActiveBoard: (boardId: string, projectId?: string | null) => void;
  readonly clearActiveProject: () => void;
}

export const ActiveProjectContext = createContext<ActiveProjectState | null>(null);

export function useActiveProject(): ActiveProjectState {
  const context = useContext(ActiveProjectContext);
  if (!context) {
    return {
      activeProjectId: ActiveProjectStorage.loadSavedProjectId(),
      activeBoardId: ActiveProjectStorage.loadSavedBoardId(),
      activeProjectName: ActiveProjectStorage.loadSavedProjectName(),
      setActiveProject: () => {},
      setActiveBoard: () => {},
      clearActiveProject: () => {},
    };
  }
  return context;
}
