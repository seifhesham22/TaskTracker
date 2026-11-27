import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NOT_AUTHENTICATED, hasErrorCode } from '../api/graphql';
import { BoardLoadError } from '../data/BoardRepository';
import { SESSION_EXPIRED } from './authErrors';
import { initials } from './format';
import { ROLE_LABELS } from './members';
import type { ProjectMember, Task } from './models';

// Wording from the designer's “Task assignee” handoff.
export const UNASSIGNED = 'Unassigned';
export const REMOVE_ASSIGNMENT_DETAIL = 'Remove the current assignment';
export const ASSIGNEE_UPDATED = 'Assignee updated';
export const ASSIGNMENT_REMOVED = 'Assignment removed';
export const LOADING_MEMBERS = 'Loading project members…';
export const NO_MATCHING_MEMBERS = 'No matching project members. Try a different search.';
export const NO_LONGER_MEMBER = 'This account is no longer a project member. Choose another member.';
export const MEMBERSHIP_REMOVED = 'Membership removed';
export const ASSIGNMENT_FAILED = 'Couldn’t update the assignee. Your selection is kept.';
export const READER_VIEW = 'Reader view · Only Owners and Writers can change the assignee.';

/** Only Owners and Writers may change who is responsible for a task (AssignTaskHandler). */
export const canManageAssignees = (role: string | null | undefined) => role === 'OWNER' || role === 'WRITER';

/** “MJ · Mina Joao”: initials plus the name, never an ID alone. */
export const assigneeLabel = (name: string) => `${initials(name)} · ${name}`;

/** “Project member · Writer”. */
export const memberDetail = (member: ProjectMember) =>
  member.role && ROLE_LABELS[member.role] ? `Project member · ${ROLE_LABELS[member.role]}` : 'Project member';

/** The task's current assignees, by name: from the project's members, else the task's own names. */
export function currentAssignees(task: Task, members: ProjectMember[]): { userId: string; userName: string }[] {
  return task.assigneeIds.map((userId, i) => ({
    userId,
    userName: members.find((m) => m.userId === userId)?.userName || task.assigneeNames?.[i] || 'Unknown member',
  }));
}

/** The project's members whose name contains the search, in any case. */
export function searchMembers(members: ProjectMember[], query: string): ProjectMember[] {
  const term = query.trim().toLowerCase();
  return term ? members.filter((m) => m.userName.toLowerCase().includes(term)) : members;
}

/**
 * What saving a choice takes, given the assignees saved now. The design proposes one assignee;
 * the backend allows several, so the chosen member is assigned first and only then anyone else
 * removed, and choosing Unassigned removes everyone. Nothing to do: both lists are empty.
 */
export function planAssigneeChange(saved: readonly string[], chosen: string | null) {
  return {
    assign: chosen && !saved.includes(chosen) ? chosen : null,
    unassign: saved.filter((id) => id !== chosen),
  };
}

export const isChange = (saved: readonly string[], chosen: string | null) => {
  const plan = planAssigneeChange(saved, chosen);
  return plan.assign !== null || plan.unassign.length > 0;
};

export type AssigneeFailure =
  /** The chosen account isn't a member of the project (any more). */
  | { kind: 'notMember' }
  /** Still a member, but the role no longer allows it. */
  | { kind: 'notAllowed'; message: string }
  /** NOT_FOUND: the task, or the user's access to the project, is gone. */
  | { kind: 'noAccess' }
  | { kind: 'form'; message: string }
  /** No usable answer: the change may have been saved all the same. */
  | { kind: 'unknown' };

// AssignTask: EnsureCanBeAssignedAsync's BAD_USER_INPUT message.
const NOT_A_MEMBER = /^User '[^']+' is not a member of project .+, so they can't be assigned to this task\.$/;

/** From the backend's error codes; the BAD_USER_INPUT message tells a non-member apart. */
export function toAssigneeFailure(error: unknown): AssigneeFailure {
  if (error instanceof ConfigurationError) return { kind: 'form', message: error.message };
  if (hasErrorCode(error, NOT_AUTHENTICATED)) return { kind: 'form', message: SESSION_EXPIRED };
  if (hasErrorCode(error, 'NOT_FOUND')) return { kind: 'noAccess' };
  if (error instanceof BoardLoadError) return error.kind === 'notFound' ? { kind: 'noAccess' } : { kind: 'unknown' };
  if (error instanceof GraphQLResponseError) {
    const refused = error.errors.find((e) => e.extensions?.code === 'AUTH_NOT_AUTHORIZED');
    if (refused) return { kind: 'notAllowed', message: refused.message || READER_VIEW };
    const input = error.errors.find((e) => e.extensions?.code === 'BAD_USER_INPUT');
    if (input) return NOT_A_MEMBER.test(input.message) ? { kind: 'notMember' } : { kind: 'form', message: input.message };
  }
  return { kind: 'unknown' };
}
