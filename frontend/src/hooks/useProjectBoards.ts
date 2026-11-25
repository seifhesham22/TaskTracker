import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { ProjectSummary } from '../api/services/AuthService';
import type { BoardDetails, BoardValidationErrors } from '../domain/models';
import { boardValidator } from '../domain/validators/BoardValidator';

export interface UseProjectBoardsResult {
  readonly project: ProjectSummary | null;
  readonly boards: readonly { readonly id: string; readonly name: string }[];
  readonly role: string | null;
  readonly isOwner: boolean;
  readonly isLoading: boolean;
  readonly isNotFound: boolean;
  readonly error: string | null;
  readonly isSubmitting: boolean;
  readonly fieldErrors: BoardValidationErrors;
  readonly submitError: string | null;
  readonly createBoard: (name: string) => Promise<BoardDetails | null>;
  readonly clearFieldErrors: () => void;
  readonly clearSubmitError: () => void;
  readonly reload: () => Promise<void>;
}

export function useProjectBoards(projectId: string, initialUserId?: string): UseProjectBoardsResult {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<BoardValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchProjectAndBoards = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsNotFound(false);
    try {
      let targetUserId = initialUserId;
      if (!targetUserId) {
        const currentUser = await api.auth.me();
        targetUserId = currentUser?.id;
      }

      if (!targetUserId) {
        setError('User profile not available.');
        setIsLoading(false);
        return;
      }

      const userProjects = await api.auth.getProjects(targetUserId);
      const foundProject = userProjects.find((p) => p.id === projectId);
      if (!foundProject) {
        setIsNotFound(true);
        setError('Project was not found.');
      } else {
        setProject(foundProject);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project boards.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, initialUserId]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        let targetUserId = initialUserId;
        if (!targetUserId) {
          const currentUser = await api.auth.me();
          targetUserId = currentUser?.id;
        }

        if (!targetUserId) {
          if (active) {
            setError('User profile not available.');
            setIsLoading(false);
          }
          return;
        }

        const userProjects = await api.auth.getProjects(targetUserId);
        if (active) {
          const foundProject = userProjects.find((p) => p.id === projectId);
          if (!foundProject) {
            setIsNotFound(true);
            setError('Project was not found.');
          } else {
            setProject(foundProject);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load project boards.');
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [projectId, initialUserId]);

  const createBoard = useCallback(
    async (name: string): Promise<BoardDetails | null> => {
      setFieldErrors({});
      setSubmitError(null);

      const validation = boardValidator.validate({ projectId, name });
      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        return null;
      }

      setIsSubmitting(true);
      try {
        const newBoard = await api.board.createBoard({ projectId, name });
        setProject((prev) => {
          if (!prev) return prev;
          const exists = prev.boards.some((b) => b.id === newBoard.id);
          if (exists) return prev;
          return {
            ...prev,
            boards: [...prev.boards, { id: newBoard.id, name: newBoard.name }],
          };
        });
        return newBoard;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Couldn’t create the board. Your name is kept. Try again.';
        if (message.toLowerCase().includes('already exists')) {
          setFieldErrors({ name: 'A board with this name already exists in this project.' });
        } else {
          setSubmitError(message);
        }
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [projectId]
  );

  const isOwner = project?.role?.toUpperCase() === 'OWNER';

  return {
    project,
    boards: project?.boards ?? [],
    role: project?.role ?? null,
    isOwner,
    isLoading,
    isNotFound,
    error,
    isSubmitting,
    fieldErrors,
    submitError,
    createBoard,
    clearFieldErrors: () => setFieldErrors({}),
    clearSubmitError: () => setSubmitError(null),
    reload: fetchProjectAndBoards,
  };
}
