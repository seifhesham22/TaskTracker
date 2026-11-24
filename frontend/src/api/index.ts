/**
 * API layer composition root: the single entry point pages use to talk to the backend.
 * Add new services here (e.g. tasks, auth) so they share one configured HttpClient.
 */
import { defaultTokenStorage } from '../auth/TokenStorage';
import { appConfig } from '../config/AppConfig';
import { FetchHttpClient } from './HttpClient';
import { AuthService } from './services/AuthService';
import { BacklogService } from './services/BacklogService';
import { BoardService } from './services/BoardService';
import { ProjectMemberService } from './services/ProjectMemberService';
import { ProjectService } from './services/ProjectService';
import { SystemService } from './services/SystemService';

const httpClient = new FetchHttpClient(
  appConfig.apiBaseUrl,
  undefined,
  () => defaultTokenStorage.getToken(),
);

export const api = {
  system: new SystemService(httpClient),
  board: new BoardService(httpClient),
  backlog: new BacklogService(httpClient),
  auth: new AuthService(httpClient),
  project: new ProjectService(httpClient),
  projectMember: new ProjectMemberService(httpClient),
} as const;

export type Api = typeof api;

export { ApiConfigurationError, ApiError, IncompleteSubtasksApiError } from './errors';
export type { IncompleteSubtaskDto } from './errors';
export type { HttpClient, RequestOptions } from './HttpClient';
export type { ApiStatus } from './services/SystemService';
export { BoardService } from './services/BoardService';
export { BacklogService } from './services/BacklogService';
export { ProjectService } from './services/ProjectService';
export { ProjectMemberService } from './services/ProjectMemberService';
export { AuthService, AuthError } from './services/AuthService';
export type {
  RegisterInput,
  RegisterResult,
  AuthUser,
  LoginInput,
  LoginResult,
  ProjectSummary,
} from './services/AuthService';
