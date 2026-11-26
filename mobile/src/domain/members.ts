import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NOT_AUTHENTICATED, hasErrorCode } from '../api/graphql';
import { SESSION_EXPIRED } from './authErrors';

/** The project roles of the design's role picker. */
export type MemberRole = 'OWNER' | 'WRITER' | 'READER';

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  WRITER: 'Writer',
  READER: 'Reader',
};

/**
 * All three are offered, as designed. The backend keeps one Owner per project (its creator) and
 * refuses a new Owner; the app shows that refusal (`OWNER_ROLE_REFUSED`).
 */
export const MEMBER_ROLES: readonly {
  role: MemberRole;
  description: string;
}[] = [
  { role: 'OWNER', description: 'Manage the project and its members' },
  { role: 'WRITER', description: 'Create and update project work' },
  { role: 'READER', description: 'View permitted project work' },
];

/** An account the add form can select. */
export interface AccountCandidate {
  userName: string;
  /**
   * `available`: an existing account found by the search. `member`: already in this project.
   * `byEmail`: a full email the search didn't find; the backend checks it exists when adding.
   */
  status: 'available' | 'member' | 'byEmail';
}

const MAX_RESULTS = 5;

/**
 * The accounts matching `query` by email (accounts have no other name), from the accounts the user
 * may see: the members of their own projects. A full email the search can't find is offered too,
 * since the account can exist outside the user's projects; the backend decides when adding.
 */
export function searchAccounts(
  query: string,
  accounts: readonly string[],
  members: readonly ProjectMemberDetails[],
): AccountCandidate[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  const memberNames = new Set(members.map((m) => m.userName.toLowerCase()));
  const found = [...new Set(accounts.map((a) => a.toLowerCase()))]
    .filter((name) => name.includes(term))
    .sort((a, b) => Number(b === term) - Number(a === term) || a.localeCompare(b))
    .slice(0, MAX_RESULTS)
    .map((name): AccountCandidate => ({
      userName: accounts.find((a) => a.toLowerCase() === name)!,
      status: memberNames.has(name) ? 'member' : 'available',
    }));
  const exact = found.some((c) => c.userName.toLowerCase() === term);
  if (!exact && EMAIL_FORMAT.test(query.trim())) {
    found.unshift({
      userName: query.trim(),
      status: memberNames.has(term) ? 'member' : 'byEmail',
    });
  }
  return found;
}

export interface ProjectMemberDetails {
  userId: string;
  /** The account's email: accounts have no other name. */
  userName: string;
  role: string;
}

export interface ProjectMembers {
  projectId: string;
  projectName: string;
  /** The signed-in user's role in the project. */
  role: string | null;
  members: ProjectMemberDetails[];
}

// Wording from the designer's member-management handoff.
export const ONLY_OWNER_MANAGES = 'Only an Owner can add or remove members.';
export const NO_ACCOUNT_FOUND = 'No accounts found. Check the name or email and search again.';
export const SEARCHING_ACCOUNTS = 'Searching accounts…';
export const SEARCH_FAILED = 'Couldn’t search accounts. Check your connection and try again.';
export const SELECTED_ACCOUNT = 'Selected existing account';
export const SELECTED_BY_EMAIL = 'Selected by email · checked when you add';
export const ownerRoleRefused = (name: string) =>
  `Couldn’t add ${name} as an Owner. A project has only one Owner. Choose Writer or Reader.`;
export const MEMBERS_REFRESH_FAILED = 'Couldn’t refresh the members.';
export const MEMBERS_LOAD_FAILED = 'Something went wrong on the server while loading the members.';
export const PROJECT_NOT_FOUND = 'This project wasn’t found, or you aren’t a member of it any more.';
export const LAST_OWNER = 'You can’t remove the last Owner.';
export const alreadyMember = (name: string) => `${name} is already a project member. Choose another account.`;
export const addFailed = (name: string) => `Couldn’t add ${name}. Your selection is kept. Try again.`;
export const removeFailed = (name: string) => `Couldn’t remove ${name}. They are still a member. Try again.`;
export const removeUnknown = (name: string) => `We couldn’t confirm whether ${name} was removed. Try again.`;
export const addedNotice = (name: string, role: string) => `${name} added as a ${ROLE_LABELS[role] ?? 'member'}.`;
export const removedNotice = (name: string) => `${name} removed. Project access revoked.`;

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const findByEmail = (members: ProjectMemberDetails[], email: string) =>
  members.find((m) => m.userName.toLowerCase() === email.toLowerCase());

/** “Owner · Last Owner”, “Writer”, … */
export function memberRoleLabel(member: ProjectMemberDetails, members: ProjectMemberDetails[]): string {
  const label = ROLE_LABELS[member.role] ?? member.role;
  const owners = members.filter((m) => m.role === 'OWNER').length;
  return member.role === 'OWNER' && owners === 1 ? `${label} · Last Owner` : label;
}

/** The backend never removes an Owner, so removing one isn't offered. */
export const canRemove = (member: ProjectMemberDetails) => member.role !== 'OWNER';

// The backend's messages (AddProjectMemberHandler, RemoveProjectMemberHandler).
const ALREADY_MEMBER = / is already a member of this project\.$/;
// Project.AddMember: "A project has only one owner. New members can be readers or writers."
const ONE_OWNER = /^A project has only one owner\./;
const NO_ACCOUNT = /^No account with the email /;
const PROJECT_MISSING = /^Project '[^']+' was not found\.$/;
const IS_OWNER = / is the owner of this project and can't be removed\.$/;
const NOT_A_MEMBER = / is not a member of this project\.$/;

/** What the backend refused and why, or null when the outcome is unknown. */
function refusalMessage(error: unknown): string | null {
  if (error instanceof ConfigurationError) return error.message;
  if (hasErrorCode(error, NOT_AUTHENTICATED)) return SESSION_EXPIRED;
  if (!(error instanceof GraphQLResponseError)) return null;
  const known = error.errors.find((e) =>
    ['BAD_USER_INPUT', 'NOT_FOUND', 'AUTH_NOT_AUTHORIZED'].includes(e.extensions?.code ?? ''),
  );
  if (!known) return null;
  return PROJECT_MISSING.test(known.message) ? PROJECT_NOT_FOUND : known.message;
}

export type AddFailure =
  | { kind: 'alreadyMember' }
  | { kind: 'noAccount' }
  | { kind: 'oneOwner' }
  | { kind: 'refused'; message: string }
  /** No usable answer: the member may have been added all the same. */
  | { kind: 'unknown' };

export function toAddFailure(error: unknown): AddFailure {
  const message = refusalMessage(error);
  if (message === null) return { kind: 'unknown' };
  if (ALREADY_MEMBER.test(message)) return { kind: 'alreadyMember' };
  if (NO_ACCOUNT.test(message)) return { kind: 'noAccount' };
  if (ONE_OWNER.test(message)) return { kind: 'oneOwner' };
  return { kind: 'refused', message };
}

export type RemoveFailure =
  | { kind: 'owner' }
  /** Someone else removed them first. */
  | { kind: 'alreadyGone' }
  /** Not allowed (any more), so trying again can't help. */
  | { kind: 'denied'; message: string }
  | { kind: 'unknown' };

export function toRemoveFailure(error: unknown): RemoveFailure {
  const message = refusalMessage(error);
  if (message === null) return { kind: 'unknown' };
  if (IS_OWNER.test(message)) return { kind: 'owner' };
  if (NOT_A_MEMBER.test(message)) return { kind: 'alreadyGone' };
  return { kind: 'denied', message };
}
