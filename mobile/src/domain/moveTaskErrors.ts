import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NetworkError } from '../api/graphql';

export const MOVE_NETWORK_ERROR = 'We couldn’t reach the server, so the task wasn’t moved. Check your connection and try again.';
export const MOVE_SERVER_ERROR = 'Something went wrong on the server, so the task wasn’t moved. Try again in a moment.';

const CODES_WITH_USER_MESSAGES = ['NOT_FOUND', 'BAD_USER_INPUT'];

export class MoveTaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoveTaskError';
  }
}

export function toMoveTaskFailureMessage(error: unknown): string {
  if (error instanceof MoveTaskError || error instanceof ConfigurationError) return error.message;
  if (error instanceof NetworkError) return MOVE_NETWORK_ERROR;
  if (error instanceof GraphQLResponseError) {
    const known = error.errors.find((entry) => CODES_WITH_USER_MESSAGES.includes(entry.extensions?.code ?? ''));
    if (known) return known.message;
  }
  return MOVE_SERVER_ERROR;
}
