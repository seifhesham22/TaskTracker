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

export async function graphqlRequest<TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
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
