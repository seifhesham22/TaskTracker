import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NOT_AUTHENTICATED, hasErrorCode } from '../api/graphql';
import { SESSION_EXPIRED } from './authErrors';

// Wording from the designer's “Create a board” handoff.
export const BOARD_NAME_REQUIRED = 'Enter a board name.';
export const BOARD_NAME_TAKEN = 'A board with this name already exists in this project.';
export const CREATE_BOARD_FAILED = 'Couldn’t create the board. Your name is kept. Try again.';
export const ONLY_OWNER_CREATES_BOARDS = 'Only an Owner can create boards.';
export const boardBelongsTo = (projectName: string) => `This board will belong to ${projectName}.`;
export const boardCreatedIn = (projectName: string) => `Board created in ${projectName}.`;

/** Board.NameMaxLength in the backend. */
export const BOARD_NAME_MAX_LENGTH = 100;
export const BOARD_NAME_TOO_LONG = `Board name cannot be longer than ${BOARD_NAME_MAX_LENGTH} characters.`;

/** The name as the backend will keep it, or why it can't be sent. */
export function validateBoardName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return BOARD_NAME_REQUIRED;
  return trimmed.length > BOARD_NAME_MAX_LENGTH ? BOARD_NAME_TOO_LONG : null;
}

export type CreateBoardFailure =
  /** Shown under the field: the name is refused (taken in this project, or not valid). */
  | { kind: 'name'; message: string }
  /** The user isn't the project's Owner (any more). */
  | { kind: 'notOwner' }
  /** The project is refused: not a member any more, or it is gone. */
  | { kind: 'noAccess' }
  /** Shown above the actions, with the name kept. */
  | { kind: 'form'; message: string }
  /** No usable answer: the board may have been created all the same. */
  | { kind: 'unknown' };

// The backend's messages about the name (CreateBoardHandler, Board.ValidName).
const DUPLICATE = /^A board named '.*' already exists in this project\.$/;
const ABOUT_NAME = /^Board name /;

/** From the backend's error codes; the BAD_USER_INPUT message tells a duplicate from a bad name. */
export function toCreateBoardFailure(error: unknown): CreateBoardFailure {
  if (error instanceof ConfigurationError) return { kind: 'form', message: error.message };
  if (hasErrorCode(error, NOT_AUTHENTICATED)) return { kind: 'form', message: SESSION_EXPIRED };
  if (hasErrorCode(error, 'NOT_FOUND')) return { kind: 'noAccess' };
  if (hasErrorCode(error, 'AUTH_NOT_AUTHORIZED')) return { kind: 'notOwner' };
  if (error instanceof GraphQLResponseError) {
    const refusal = error.errors.find((e) => e.extensions?.code === 'BAD_USER_INPUT');
    if (refusal) {
      if (DUPLICATE.test(refusal.message)) return { kind: 'name', message: BOARD_NAME_TAKEN };
      if (ABOUT_NAME.test(refusal.message))
        return { kind: 'name', message: /empty/.test(refusal.message) ? BOARD_NAME_REQUIRED : refusal.message };
      return { kind: 'form', message: refusal.message || CREATE_BOARD_FAILED };
    }
  }
  return { kind: 'unknown' };
}

/** The backend compares names within a project without regard to case. */
export const sameBoardName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
