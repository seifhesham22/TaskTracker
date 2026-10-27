/**
 * Application configuration read from Vite environment variables.
 *
 * The backend address comes from VITE_API_URL (see frontend/.env.example),
 * so it is never hardcoded in the source.
 */
export class AppConfig {
  readonly apiBaseUrl: string | null;

  constructor(env: ImportMetaEnv = import.meta.env) {
    const rawUrl = env.VITE_API_URL?.trim();
    this.apiBaseUrl = rawUrl ? rawUrl.replace(/\/+$/, '') : null;
  }

  get isApiConfigured(): boolean {
    return this.apiBaseUrl !== null;
  }
}

export const appConfig = new AppConfig();
