import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NOT_AUTHENTICATED, hasErrorCode } from '../api/graphql';
import { SESSION_EXPIRED } from './authErrors';
import type { ProjectSummary } from './models';

// Wording from the designer's Create a project handoff.
export const PROJECT_NAME_REQUIRED = 'Enter a project name.';
export const CREATE_PROJECT_FAILED = 'Couldn’t create the project. Your name is kept. Try again.';
export const PROJECT_CREATED = 'Project created. You are the Owner.';
export const PROJECTS_REFRESH_FAILED = 'Couldn’t refresh your projects.';

const ROLE_LABELS: Record<string, string> = { OWNER: 'Owner', WRITER: 'Writer', READER: 'Reader' };

/** “Owner · Private project”: every project is visible to its members only. */
export function projectAccessLabel(role: string | null): string {
  const label = role ? ROLE_LABELS[role] : undefined;
  return label ? `${label} · Private project` : 'Private project';
}

export interface CreateProjectErrors {
  name?: string;
  form?: string;
}

/** Only an empty name is refused here; any other rule (e.g. its length) is the backend's. */
export function validateProjectName(name: string): string | null {
  return name.trim() ? null : PROJECT_NAME_REQUIRED;
}

export interface CreateProjectFailure {
  errors: CreateProjectErrors;
  /** The backend may have saved the project although no usable answer came back. */
  uncertain: boolean;
}

// The backend's messages about the name (Project.Rename).
const NAME_EMPTY = /^Project name cannot be empty/;
const ABOUT_NAME = /^Project name /;

export function toCreateProjectFailure(error: unknown): CreateProjectFailure {
  if (error instanceof ConfigurationError) return { errors: { form: error.message }, uncertain: false };
  if (hasErrorCode(error, NOT_AUTHENTICATED)) return { errors: { form: SESSION_EXPIRED }, uncertain: false };
  if (error instanceof GraphQLResponseError) {
    const refusal = error.errors.find((e) => e.extensions?.code === 'BAD_USER_INPUT');
    if (refusal) {
      if (NAME_EMPTY.test(refusal.message)) return { errors: { name: PROJECT_NAME_REQUIRED }, uncertain: false };
      if (ABOUT_NAME.test(refusal.message)) return { errors: { name: refusal.message }, uncertain: false };
      return { errors: { form: refusal.message || CREATE_PROJECT_FAILED }, uncertain: false };
    }
  }
  return { errors: { form: CREATE_PROJECT_FAILED }, uncertain: true };
}

/** A project of this name that the user owns and that wasn't there before the first attempt. */
export function findCreatedProject(
  projects: ProjectSummary[],
  name: string,
  before: ReadonlySet<string>,
): ProjectSummary | undefined {
  return projects.find((p) => p.name === name && p.role === 'OWNER' && !before.has(p.id));
}
