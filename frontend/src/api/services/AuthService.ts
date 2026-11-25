import type { HttpClient } from '../HttpClient';

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
}

export interface RegisterResult {
  readonly id: string;
  readonly email: string;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface LoginResult {
  readonly accessToken: string;
  readonly tokenType: string;
  readonly expiresAt?: string;
  readonly user: AuthUser;
}

export interface ProjectBoardSummary {
  readonly id: string;
  readonly name: string;
}

export interface ProjectMemberSummary {
  readonly userId?: string;
  readonly userName: string;
  readonly role: string;
}

export interface ProjectSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description?: string | null;
  readonly role: string;
  readonly boards: readonly ProjectBoardSummary[];
  readonly projectMembers?: readonly ProjectMemberSummary[];
}

export class AuthError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

interface GraphQLErrorPayload {
  message?: string;
  extensions?: {
    code?: string;
  };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLErrorPayload[];
}

/**
 * Handles authentication-related API calls (register, login, logout, me, getProjects).
 * Follows the same GraphQL-over-HTTP pattern as BoardService.
 */
export class AuthService {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const mutation = `
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          id
          email
        }
      }
    `;

    const result = await this.httpClient.post<GraphQLResponse<{ register: RegisterResult }>>(
      '/graphql',
      {
        query: mutation,
        variables: {
          input: {
            email: input.email.trim(),
            password: input.password,
          },
        },
      },
    );

    if (result.errors && result.errors.length > 0) {
      const firstError = result.errors[0];
      throw new AuthError(firstError.message || 'Registration failed.', firstError.extensions?.code);
    }

    if (!result.data?.register) {
      throw new AuthError('Registration failed. Please try again.');
    }

    return result.data.register;
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const query = `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          accessToken
          tokenType
          expiresAt
          user {
            id
            email
          }
        }
      }
    `;

    const response = await this.httpClient.post<GraphQLResponse<{ login: LoginResult }>>(
      '/graphql',
      {
        query,
        variables: {
          input: {
            email: input.email.trim(),
            password: input.password,
          },
        },
      },
    );

    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      const code = firstError.extensions?.code;
      const message = firstError.message || 'Invalid email or password.';
      throw new AuthError(message, code);
    }

    if (!response.data?.login) {
      throw new AuthError('Failed to log in: no data returned.');
    }

    return response.data.login;
  }

  async logout(): Promise<void> {
    const query = `
      mutation Logout {
        logout
      }
    `;

    try {
      await this.httpClient.post<GraphQLResponse<{ logout: boolean }>>('/graphql', { query });
    } catch {
      // Logout in frontend should always succeed locally even if network/token is already expired
    }
  }

  async me(): Promise<AuthUser | null> {
    const query = `
      query Me {
        me {
          id
          email
        }
      }
    `;

    try {
      const response = await this.httpClient.post<GraphQLResponse<{ me: AuthUser }>>('/graphql', {
        query,
      });

      if (response.errors && response.errors.length > 0) {
        return null;
      }

      return response.data?.me ?? null;
    } catch {
      return null;
    }
  }

  async getProjects(userId: string): Promise<readonly ProjectSummary[]> {
    const query = `
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
            userId
            userName
            role
          }
        }
      }
    `;

    const response = await this.httpClient.post<GraphQLResponse<{ projects: ProjectSummary[] }>>(
      '/graphql',
      {
        query,
        variables: { userId },
      },
    );

    if (response.errors && response.errors.length > 0) {
      const firstError = response.errors[0];
      throw new AuthError(firstError.message || 'Failed to load projects.', firstError.extensions?.code);
    }

    return response.data?.projects ?? [];
  }
}
