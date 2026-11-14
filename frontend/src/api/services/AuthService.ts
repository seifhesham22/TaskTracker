import type { HttpClient } from '../HttpClient';
import type { GraphQLResponse } from './BoardService';

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
}

export interface RegisterResult {
  readonly id: string;
  readonly email: string;
}

/**
 * Handles authentication-related API calls (register, login, logout).
 * Follows the same GraphQL-over-HTTP pattern as BoardService.
 */
export class AuthService {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
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

    const result = await this.client.post<GraphQLResponse<{ register: RegisterResult }>>(
      '/graphql',
      { query: mutation, variables: { input } }
    );

    if (result.errors && result.errors.length > 0) {
      throw new AuthError(result.errors[0].message, result.errors[0].extensions?.code);
    }

    if (!result.data?.register) {
      throw new AuthError('Registration failed. Please try again.');
    }

    return result.data.register;
  }
}

/** Domain error from an authentication operation. */
export class AuthError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

