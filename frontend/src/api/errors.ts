/** The backend responded with a non-2xx status code. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** A request was attempted while VITE_API_URL is not configured. */
export class ApiConfigurationError extends Error {
  constructor() {
    super('VITE_API_URL is not set. Copy frontend/.env.example to frontend/.env and set it.');
    this.name = 'ApiConfigurationError';
  }
}
