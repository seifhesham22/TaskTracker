import type { HttpClient } from '../HttpClient';
import { ApiError } from '../errors';
import type { GraphQLResponse } from './BoardService';
import type { ProjectSummary } from './AuthService';
import {
  ProjectRole,
  type AddProjectMemberInput,
  type ProjectMember,
} from '../../domain/models';

export interface ProjectDetails extends ProjectSummary {
  readonly projectMembers: readonly ProjectMember[];
}

export const GET_PROJECT_DETAILS_QUERY = `
  query GetProjectDetails($userId: UUID) {
    projects(userId: $userId) {
      id
      key
      name
      description
      role
      boards {
        id
        name
      }
      projectMembers {
        projectId
        userId
        userName
        role
        joinedAt
      }
    }
  }
`;

export const ADD_PROJECT_MEMBER_MUTATION = `
  mutation AddProjectMember($input: AddProjectMemberInput!) {
    addProjectMember(input: $input) {
      projectId
      userId
      userName
      role
      joinedAt
    }
  }
`;

export const REMOVE_PROJECT_MEMBER_MUTATION = `
  mutation RemoveProjectMember($input: RemoveProjectMemberInput!) {
    removeProjectMember(input: $input) {
      projectId
      userId
      userName
      role
      joinedAt
    }
  }
`;

export class ProjectMemberService {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  async getProjectDetails(projectId: string, userId?: string): Promise<ProjectDetails> {
    const response = await this.client.post<GraphQLResponse<{ projects?: ProjectDetails[] }>>(
      '/graphql',
      {
        query: GET_PROJECT_DETAILS_QUERY,
        variables: userId ? { userId } : {},
      }
    );

    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      const code = firstError.extensions?.code;
      const status = code === 'AUTH_NOT_AUTHENTICATED' ? 401 : code === 'BAD_USER_INPUT' ? 400 : 500;
      throw new ApiError(firstError.message || 'Failed to load project members.', status, response.errors);
    }

    const project = response.data?.projects?.find((p) => p.id === projectId);
    if (!project) {
      throw new ApiError(`Project '${projectId}' was not found.`, 404, null);
    }

    return project;
  }

  async addProjectMember(input: AddProjectMemberInput): Promise<ProjectMember> {
    const payloadInput = {
      projectId: input.projectId,
      email: input.email.trim(),
      role: input.role || ProjectRole.Writer,
    };

    const response = await this.client.post<GraphQLResponse<{ addProjectMember?: ProjectMember | null }>>(
      '/graphql',
      {
        query: ADD_PROJECT_MEMBER_MUTATION,
        variables: { input: payloadInput },
      }
    );

    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      const code = firstError.extensions?.code;
      const status =
        code === 'AUTH_NOT_AUTHENTICATED'
          ? 401
          : code === 'BAD_USER_INPUT'
          ? 400
          : code === 'NOT_FOUND'
          ? 404
          : 500;

      throw new ApiError(
        firstError.message || 'Couldn’t add member. Your selection is kept. Try again.',
        status,
        response.errors
      );
    }

    if (!response.data?.addProjectMember) {
      throw new ApiError('Couldn’t add member. Your selection is kept. Try again.', 500, null);
    }

    return response.data.addProjectMember;
  }

  async removeProjectMember(projectId: string, userId: string): Promise<ProjectMember> {
    const response = await this.client.post<GraphQLResponse<{ removeProjectMember?: ProjectMember | null }>>(
      '/graphql',
      {
        query: REMOVE_PROJECT_MEMBER_MUTATION,
        variables: { input: { projectId, userId } },
      }
    );

    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      const code = firstError.extensions?.code;
      const status =
        code === 'AUTH_NOT_AUTHENTICATED'
          ? 401
          : code === 'BAD_USER_INPUT'
          ? 400
          : code === 'NOT_FOUND'
          ? 404
          : 500;

      throw new ApiError(
        firstError.message || 'Couldn’t remove member. They are still a member. Try again.',
        status,
        response.errors
      );
    }

    if (!response.data?.removeProjectMember) {
      throw new ApiError('Couldn’t remove member. They are still a member. Try again.', 500, null);
    }

    return response.data.removeProjectMember;
  }
}
