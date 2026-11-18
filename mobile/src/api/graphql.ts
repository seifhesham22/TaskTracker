import { getSession, reportUnauthenticated } from '../auth/session';
import { ApiError, apiClient, getBaseUrl } from './client';

export interface GraphQLErrorEntry {
  message: string;
  extensions?: { code?: string; [key: string]: unknown };
}

interface GraphQLResponse<TData> {
  data?: TData | null;
  errors?: GraphQLErrorEntry[];
}

export class GraphQLResponseError extends Error {
  constructor(
    public readonly errors: GraphQLErrorEntry[],
    public readonly status: number,
  ) {
    super(errors[0]?.message ?? 'GraphQL request failed');
    this.name = 'GraphQLResponseError';
  }
}

export class NetworkError extends Error {
  constructor(public readonly cause: unknown) {
    super('Network request failed');
    this.name = 'NetworkError';
  }
}

function errorsFrom(body: unknown): GraphQLErrorEntry[] | null {
  if (body && typeof body === 'object' && Array.isArray((body as GraphQLResponse<unknown>).errors)) {
    const errors = (body as GraphQLResponse<unknown>).errors!;
    return errors.length > 0 ? errors : null;
  }
  return null;
}

/** The backend's code for a request without a valid token (missing, expired, revoked or forged). */
export const NOT_AUTHENTICATED = 'AUTH_NOT_AUTHENTICATED';

export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof GraphQLResponseError && error.errors.some((e) => e.extensions?.code === code);
}

export interface GraphQLRequestOptions {
  /**
   * The token to send. Omit it to send the signed-in session's token, if any; a refusal of that
   * token then signs the user out. Pass a token (or `null` for none) to send exactly that and handle
   * a refusal yourself, as the auth operations do.
   */
  accessToken?: string | null;
}

export async function graphqlRequest<TData>(
  query: string,
  variables?: Record<string, unknown>,
  options: GraphQLRequestOptions = {},
): Promise<TData> {
  getBaseUrl();

  const usesSession = options.accessToken === undefined;
  const accessToken = usesSession ? (getSession()?.accessToken ?? null) : options.accessToken;
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const fail = (errors: GraphQLErrorEntry[], status: number): never => {
    const error = new GraphQLResponseError(errors, status);
    if (usesSession && accessToken && hasErrorCode(error, NOT_AUTHENTICATED)) {
      reportUnauthenticated(accessToken);
    }
    throw error;
  };

  let body: GraphQLResponse<TData> | undefined;
  try {
    body = await apiClient.post<GraphQLResponse<TData>>('graphql', { query, variables }, { headers });
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = errorsFrom(error.body);
      if (errors) {
        fail(errors, error.status);
      }
      throw error;
    }
    throw new NetworkError(error);
  }

  const errors = errorsFrom(body);
  if (errors) {
    fail(errors, 200);
  }
  if (!body || typeof body !== 'object' || body.data == null) {
    throw new ApiError('The server returned no data', 200, body);
  }
  return body.data;
}
