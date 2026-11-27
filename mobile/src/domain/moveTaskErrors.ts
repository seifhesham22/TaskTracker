import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NetworkError } from '../api/graphql';
import { blockersFromError, type Blocker } from './blockers';

export const MOVE_NETWORK_ERROR = 'We couldn’t reach the server, so the task wasn’t moved. Check your connection and try again.';
export const MOVE_SERVER_ERROR = 'Something went wrong on the server, so the task wasn’t moved. Try again in a moment.';

const CODES_WITH_USER_MESSAGES = ['NOT_FOUND', 'BAD_USER_INPUT'];

export class MoveTaskError extends Error {
  constructor(
    message: string,
    /** US-17: the unfinished tasks the backend named when it refused to start this one. */
    public readonly blockers: Blocker[] | null = null,
    /** No usable answer: the move may have been saved all the same. */
    public readonly uncertain = false,
  ) {
    super(message);
    this.name = 'MoveTaskError';
  }
}

/** The refusal or failure of a move, keeping what the screens need to tell them apart. */
export function toMoveTaskError(error: unknown): MoveTaskError {
  if (error instanceof MoveTaskError) return error;
  const uncertain = error instanceof NetworkError || !(error instanceof GraphQLResponseError || error instanceof ConfigurationError);
  return new MoveTaskError(toMoveTaskFailureMessage(error), blockersFromError(error), uncertain);
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
