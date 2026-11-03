import { ApiError, apiClient, getBaseUrl } from './client';

/** One entry of the GraphQL `errors` list. The backend puts its error code in `extensions.code`. */
export interface GraphQLErrorEntry {
  message: string;
  extensions?: { code?: string; [key: string]: unknown };
}

interface GraphQLResponse<TData> {
  data?: TData | null;
  errors?: GraphQLErrorEntry[];
}

/** The server answered, but with GraphQL errors (this also happens with HTTP 200). */
export class GraphQLResponseError extends Error {
  constructor(
    public readonly errors: GraphQLErrorEntry[],
    public readonly status: number,
  ) {
    super(errors[0]?.message ?? 'GraphQL request failed');
    this.name = 'GraphQLResponseError';
  }
}

/** The request never got an answer: no connection, DNS failure, server down, timeout. */
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

/**
 * Sends a GraphQL operation to `<EXPO_PUBLIC_API_URL>/graphql` through the shared API client.
 *
 * Throws:
 * - the client's configuration error when EXPO_PUBLIC_API_URL is not set,
 * - `NetworkError` when no response arrives,
 * - `GraphQLResponseError` when the response has an `errors` list (any HTTP status),
 * - `ApiError` for other non-2xx responses (for example a 502 from a proxy).
 */
export async function graphqlRequest<TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  // Fail on missing configuration before the request, so it isn't mistaken for a network error.
  getBaseUrl();

  let body: GraphQLResponse<TData> | undefined;
  try {
    body = await apiClient.post<GraphQLResponse<TData>>('graphql', { query, variables });
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = errorsFrom(error.body);
      if (errors) {
        throw new GraphQLResponseError(errors, error.status);
      }
      throw error;
    }
    throw new NetworkError(error);
  }

  const errors = errorsFrom(body);
  if (errors) {
    throw new GraphQLResponseError(errors, 200);
  }
  if (!body || typeof body !== 'object' || body.data == null) {
    throw new ApiError('The server returned no data', 200, body);
  }
  return body.data;
}
