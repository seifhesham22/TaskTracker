import { createContext, useContext, type ReactNode } from 'react';

import { createBackendBoardRepository } from './backendBoardRepository';
import type { BoardRepository } from './BoardRepository';

const backendRepository = createBackendBoardRepository();

const BoardRepositoryContext = createContext<BoardRepository>(backendRepository);

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
  return useContext(BoardRepositoryContext);
}
