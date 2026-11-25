import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  ActiveProjectContext,
  ActiveProjectStorage,
  type ActiveProjectState,
} from './activeProjectContextDef';

export interface ActiveProjectProviderProps {
  readonly children: ReactNode;
}

export function ActiveProjectProvider({ children }: ActiveProjectProviderProps) {
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() =>
    ActiveProjectStorage.loadSavedProjectId()
  );
  const [activeBoardId, setActiveBoardIdState] = useState<string | null>(() =>
    ActiveProjectStorage.loadSavedBoardId()
  );
  const [activeProjectName, setActiveProjectNameState] = useState<string | null>(() =>
    ActiveProjectStorage.loadSavedProjectName()
  );

  const setActiveProject = useCallback(
    (projectId: string, boardId?: string | null, projectName?: string | null) => {
      setActiveProjectIdState(projectId);
      if (boardId !== undefined) {
        setActiveBoardIdState(boardId);
      }
      if (projectName !== undefined) {
        setActiveProjectNameState(projectName);
      }
      ActiveProjectStorage.saveActiveState(
        projectId,
        boardId !== undefined ? boardId : activeBoardId,
        projectName !== undefined ? projectName : activeProjectName
      );
    },
    [activeBoardId, activeProjectName]
  );

  const setActiveBoard = useCallback(
    (boardId: string, projectId?: string | null) => {
      setActiveBoardIdState(boardId);
      if (projectId) {
        setActiveProjectIdState(projectId);
      }
      ActiveProjectStorage.saveActiveState(
        projectId || activeProjectId,
        boardId,
        activeProjectName
      );
    },
    [activeProjectId, activeProjectName]
  );

  const clearActiveProject = useCallback(() => {
    setActiveProjectIdState(null);
    setActiveBoardIdState(null);
    setActiveProjectNameState(null);
    ActiveProjectStorage.clear();
  }, []);

  const value = useMemo<ActiveProjectState>(
    () => ({
      activeProjectId,
      activeBoardId,
      activeProjectName,
      setActiveProject,
      setActiveBoard,
      clearActiveProject,
    }),
    [activeProjectId, activeBoardId, activeProjectName, setActiveProject, setActiveBoard, clearActiveProject]
  );

  return (
    <ActiveProjectContext.Provider value={value}>
      {children}
    </ActiveProjectContext.Provider>
  );
}
