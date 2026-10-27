import { ApiConfigurationError, ApiError } from '../errors';
import type { HttpClient } from '../HttpClient';

export type ApiStatus = 'online' | 'offline' | 'unconfigured';

/** Backend-wide operations that are not tied to a domain entity. */
export class SystemService {
  private static readonly PROBE_PATH = 'openapi/v1.json';

  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** Checks whether the backend can be reached from the browser. */
  async checkStatus(): Promise<ApiStatus> {
    try {
      await this.http.get(SystemService.PROBE_PATH);
      return 'online';
    } catch (error) {
      if (error instanceof ApiConfigurationError) {
        return 'unconfigured';
      }
      // Any HTTP response (even 404 outside Development) means the server is reachable.
      if (error instanceof ApiError) {
        return 'online';
      }
      return 'offline';
    }
  }
}
