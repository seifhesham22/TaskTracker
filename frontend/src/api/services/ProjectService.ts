import type { HttpClient } from '../HttpClient';
import { ApiError } from '../errors';
import type { GraphQLResponse } from './BoardService';
import type { ProjectSummary } from './AuthService';
import type { CreateProjectInput } from '../../domain/models';

export const CREATE_PROJECT_MUTATION = `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
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
        userName
        role
      }
    }
  }
`;

export const GET_PROJECTS_QUERY = `
  query Projects($userId: UUID!) {
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
        userName
        role
      }
    }
  }
`;

export class ProjectService {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  async createProject(input: CreateProjectInput): Promise<ProjectSummary> {
    const payloadInput: { name: string; key?: string; description?: string } = {
      name: input.name.trim(),
    };
    if (input.key?.trim()) {
      payloadInput.key = input.key.trim();
    }
    if (input.description?.trim()) {
      payloadInput.description = input.description.trim();
    }

    const response = await this.client.post<GraphQLResponse<{ createProject?: ProjectSummary | null }>>(
      '/graphql',
      {
        query: CREATE_PROJECT_MUTATION,
        variables: { input: payloadInput },
      }
    );

    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      const code = firstError.extensions?.code;
      const status = code === 'AUTH_NOT_AUTHENTICATED' ? 401 : code === 'BAD_USER_INPUT' ? 400 : 500;
      throw new ApiError(
        firstError.message || 'Couldn’t create the project. Your name is kept. Try again.',
        status,
        response.errors
      );
    }

    if (!response.data?.createProject) {
      throw new ApiError('Couldn’t create the project. Your name is kept. Try again.', 500, null);
    }

    return response.data.createProject;
  }

  async getProjects(userId: string): Promise<readonly ProjectSummary[]> {
    const response = await this.client.post<GraphQLResponse<{ projects?: ProjectSummary[] }>>(
      '/graphql',
      {
        query: GET_PROJECTS_QUERY,
        variables: { userId },
      }
    );

    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      throw new ApiError(firstError.message || 'Failed to load projects.', 400, response.errors);
    }

    return response.data?.projects ?? [];
  }
}
