import { ApiError } from '../api/client';
import { GraphQLResponseError, NetworkError, type GraphQLErrorEntry } from '../api/graphql';
import { TITLE_MAX_LENGTH, type CreateTaskInput } from './models';

export const TITLE_REQUIRED = 'Title is required';
export const TITLE_TOO_LONG = `Title can’t be longer than ${TITLE_MAX_LENGTH} characters.`;

export const GENERAL_ERROR_TITLE = 'Couldn’t create the task';
export const SERVER_ERROR_DESCRIPTION =
  'Something went wrong on our side. Nothing was lost — your changes are still here. Try again in a moment.';
export const NETWORK_ERROR_DESCRIPTION =
  'We couldn’t reach the server. Check your connection. Nothing was lost — your changes are still here.';
export const COLUMN_MISSING_DESCRIPTION =
  'The column this task was going into is no longer on this board. Nothing was lost — your changes are still here. Go back to the board to refresh it, then try again.';

export type CreateTaskField = 'title' | 'assigneeId';

export interface GeneralFormError {
  title: string;
  description: string;
}

export type CreateTaskFailure =
  /** Errors shown under the field they belong to. */
  | { kind: 'fields'; fields: Partial<Record<CreateTaskField, string>> }
  /** The board itself is gone: the board screen shows "Board not found". */
  | { kind: 'boardNotFound'; message: string }
  /** Errors that belong to no field: FormErrorAlert at the top of the form. */
  | {
      kind: 'general';
      reason: 'network' | 'server' | 'rejected' | 'configuration';
      error: GeneralFormError;
    };

export class CreateTaskError extends Error {
  constructor(public readonly failure: CreateTaskFailure) {
    super(failure.kind === 'general' ? failure.error.description : failure.kind);
    this.name = 'CreateTaskError';
  }
}

// Messages produced by the backend (CreateTaskHandler, TaskItem). Both "board missing" and
// "column missing" use the code NOT_FOUND, and the backend sends no other field that tells them
// apart, so the message text and the IDs in it are what identify the missing resource.
const BOARD_NOT_FOUND = /^Board '([^']+)' was not found\.$/;
const COLUMN_NOT_FOUND = /^Column '([^']+)' was not found on board '([^']+)'\.$/;
const NOT_A_MEMBER = /^User '([^']+)' is not a member of project /;
const TITLE_EMPTY = /^Title cannot be empty/;
const TITLE_LONG = /^Title cannot be longer than/;

const sameId = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

type Classified =
  | { kind: 'boardNotFound'; message: string }
  | { kind: 'field'; field: CreateTaskField; message: string }
  | { kind: 'general'; reason: 'server' | 'rejected'; error: GeneralFormError };

function classify(entry: GraphQLErrorEntry, input: CreateTaskInput): Classified {
  const code = entry.extensions?.code;
  const message = entry.message ?? '';

  if (code === 'NOT_FOUND') {
    const board = BOARD_NOT_FOUND.exec(message);
    if (board && sameId(board[1], input.boardId)) {
      return { kind: 'boardNotFound', message };
    }
    const column = COLUMN_NOT_FOUND.exec(message);
    if (column) {
      return {
        kind: 'general',
        reason: 'rejected',
        error: { title: GENERAL_ERROR_TITLE, description: COLUMN_MISSING_DESCRIPTION },
      };
    }
    return { kind: 'general', reason: 'rejected', error: { title: GENERAL_ERROR_TITLE, description: message } };
  }

  if (code === 'BAD_USER_INPUT') {
    const member = NOT_A_MEMBER.exec(message);
    if (member && sameId(member[1], input.assigneeId)) {
      // Show the server's own reason under Assignee.
      return { kind: 'field', field: 'assigneeId', message };
    }
    if (TITLE_EMPTY.test(message)) return { kind: 'field', field: 'title', message: TITLE_REQUIRED };
    if (TITLE_LONG.test(message)) return { kind: 'field', field: 'title', message: TITLE_TOO_LONG };
    // For example "This board has no columns, so the task can't get a status."
    return { kind: 'general', reason: 'rejected', error: { title: GENERAL_ERROR_TITLE, description: message } };
  }

  // No known code: an unexpected server error ("Unexpected Execution Error") or a schema error.
  return {
    kind: 'general',
    reason: 'server',
    error: { title: GENERAL_ERROR_TITLE, description: SERVER_ERROR_DESCRIPTION },
  };
}

/** Turns anything thrown by the createTask request into what the form should show. */
export function toCreateTaskFailure(error: unknown, input: CreateTaskInput): CreateTaskFailure {
  if (error instanceof CreateTaskError) return error.failure;

  if (error instanceof GraphQLResponseError) {
    const classified = error.errors.map((entry) => classify(entry, input));

    const boardNotFound = classified.find((c) => c.kind === 'boardNotFound');
    if (boardNotFound) return boardNotFound;

    const general = classified.find((c) => c.kind === 'general');
    if (general) return general;

    const fields: Partial<Record<CreateTaskField, string>> = {};
    for (const c of classified) {
      if (c.kind === 'field' && !fields[c.field]) fields[c.field] = c.message;
    }
    return { kind: 'fields', fields };
  }

  if (error instanceof NetworkError) {
    return {
      kind: 'general',
      reason: 'network',
      error: { title: GENERAL_ERROR_TITLE, description: NETWORK_ERROR_DESCRIPTION },
    };
  }

  if (error instanceof ApiError) {
    return {
      kind: 'general',
      reason: 'server',
      error: { title: GENERAL_ERROR_TITLE, description: SERVER_ERROR_DESCRIPTION },
    };
  }

  // For example EXPO_PUBLIC_API_URL not configured.
  return {
    kind: 'general',
    reason: 'configuration',
    error: {
      title: GENERAL_ERROR_TITLE,
      description: error instanceof Error ? error.message : SERVER_ERROR_DESCRIPTION,
    },
  };
}

/** Client-side Title rule, the same as the backend: trimmed, not empty, at most 200 characters. */
export function validateTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) return TITLE_REQUIRED;
  if (trimmed.length > TITLE_MAX_LENGTH) return TITLE_TOO_LONG;
  return null;
}
