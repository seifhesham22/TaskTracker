import { createContext, useContext, type ReactNode } from 'react';

import { createBackendBoardRepository } from './backendBoardRepository';
import type { BoardRepository } from './BoardRepository';
import { createDemoBoardRepository } from './demoBoardRepository';

/**
 * Demo mode is on when EXPO_PUBLIC_MOBILE_DEMO_MODE is exactly "true", or when no backend is
 * configured (EXPO_PUBLIC_API_URL empty): without a backend, nothing could be loaded at all.
 * (Expo inlines EXPO_PUBLIC_* variables at build time, so these must stay direct property accesses.)
 */
export function isDemoMode(): boolean {
  return process.env.EXPO_PUBLIC_MOBILE_DEMO_MODE === 'true' || !process.env.EXPO_PUBLIC_API_URL;
}

let appRepository: BoardRepository | null = null;

/** One repository for the whole app, so the demo board keeps its tasks between screens. */
export function getAppBoardRepository(): BoardRepository {
  appRepository ??= isDemoMode() ? createDemoBoardRepository() : createBackendBoardRepository();
  return appRepository;
}

const BoardRepositoryContext = createContext<BoardRepository | null>(null);

/** Lets tests (or a future app-level setup) supply the data source. */
export function BoardRepositoryProvider({
  repository,
  children,
}: {
  repository: BoardRepository;
  children: ReactNode;
}) {
  return <BoardRepositoryContext.Provider value={repository}>{children}</BoardRepositoryContext.Provider>;
}

export function useBoardRepository(): BoardRepository {
  return useContext(BoardRepositoryContext) ?? getAppBoardRepository();
}
