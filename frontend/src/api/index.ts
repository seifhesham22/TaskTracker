/**
 * API layer composition root: the single entry point pages use to talk to the backend.
 * Add new services here (e.g. tasks, auth) so they share one configured HttpClient.
 */
import { appConfig } from '../config/AppConfig';
import { FetchHttpClient } from './HttpClient';
import { BoardService } from './services/BoardService';
import { SystemService } from './services/SystemService';

const httpClient = new FetchHttpClient(appConfig.apiBaseUrl);

export const api = {
  system: new SystemService(httpClient),
  board: new BoardService(httpClient),
} as const;

export type Api = typeof api;

export { ApiConfigurationError, ApiError } from './errors';
export type { HttpClient, RequestOptions } from './HttpClient';
export type { ApiStatus } from './services/SystemService';
export { BoardService } from './services/BoardService';
