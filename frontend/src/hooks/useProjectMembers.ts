import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ProjectDetails } from '../api/services/ProjectMemberService';
import { useAuth } from '../auth/useAuth';
import { ProjectRole, type AddProjectMemberInput, type ProjectMember } from '../domain/models';

export interface UseProjectMembersResult {
  readonly project: ProjectDetails | null;
  readonly members: readonly ProjectMember[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isOwner: boolean;
  readonly currentUserId?: string;
  readonly lastOwnerId: string | null;
  readonly addMember: (input: Omit<AddProjectMemberInput, 'projectId'>) => Promise<ProjectMember>;
  readonly removeMember: (userId: string) => Promise<ProjectMember>;
  readonly reload: () => Promise<void>;
}

export function useProjectMembers(projectId?: string): UseProjectMembersResult {
  const { user } = useAuth();
  const userId = user?.id;

  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [members, setMembers] = useState<readonly ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const details = await api.projectMember.getProjectDetails(projectId, userId);
      setProject(details);
      setMembers(details.projectMembers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project members.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, userId]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!projectId) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const details = await api.projectMember.getProjectDetails(projectId, userId);
        if (active) {
          setProject(details);
          setMembers(details.projectMembers || []);
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load project members.');
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [projectId, userId]);

  const owners = useMemo(() => {
    return members.filter((m) => m.role === ProjectRole.Owner);
  }, [members]);

  const lastOwnerId = useMemo(() => {
    return owners.length === 1 ? owners[0].userId : null;
  }, [owners]);

  const isOwner = useMemo(() => {
    if (!project) return false;
    return project.role?.toUpperCase() === ProjectRole.Owner;
  }, [project]);

  const addMember = useCallback(
    async (input: Omit<AddProjectMemberInput, 'projectId'>): Promise<ProjectMember> => {
      if (!projectId) {
        throw new Error('Project ID is required.');
      }

      const newMember = await api.projectMember.addProjectMember({
        projectId,
        email: input.email,
        role: input.role,
      });

      setMembers((prev) => [...prev, newMember]);
      return newMember;
    },
    [projectId]
  );

  const removeMember = useCallback(
    async (targetUserId: string): Promise<ProjectMember> => {
      if (!projectId) {
        throw new Error('Project ID is required.');
      }

      const removed = await api.projectMember.removeProjectMember(projectId, targetUserId);
      setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
      return removed;
    },
    [projectId]
  );

  return {
    project,
    members,
    isLoading,
    error,
    isOwner,
    currentUserId: userId,
    lastOwnerId,
    addMember,
    removeMember,
    reload: fetchMembers,
  };
}
