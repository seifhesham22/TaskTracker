import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { ProjectSummary } from '../api/services/AuthService';
import type { CreateProjectInput } from '../domain/models';

export function useProjects(userId?: string) {
  const [projects, setProjects] = useState<readonly ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let targetUserId = userId;
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
      setProjects(userProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const createProject = useCallback(async (input: CreateProjectInput): Promise<ProjectSummary> => {
    const newProject = await api.project.createProject(input);
    setProjects((prev) => [newProject, ...prev]);
    return newProject;
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        let targetUserId = userId;
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
          setProjects(userProjects);
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load projects.');
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [userId]);

  return { projects, isLoading, error, reload: fetchProjects, createProject };
}
