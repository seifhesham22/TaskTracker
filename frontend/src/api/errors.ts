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

export interface IncompleteSubtaskDto {
  readonly id: string;
  readonly readableId: string;
  readonly title: string;
}

export interface TaskBlockerDto {
  readonly id: string;
  readonly readableId: string;
  readonly title: string;
  readonly status?: string;
}

/** Thrown when parent task completion is rejected due to incomplete subtasks. */
export class IncompleteSubtasksApiError extends ApiError {
  readonly incompleteSubtasks: readonly IncompleteSubtaskDto[];

  constructor(
    message: string,
    incompleteSubtasks: readonly IncompleteSubtaskDto[],
    body: unknown
  ) {
    super(message, 400, body);
    this.name = 'IncompleteSubtasksApiError';
    this.incompleteSubtasks = incompleteSubtasks;
  }
}

/** Thrown when starting a task is rejected due to unfinished blocking tasks. */
export class BlockedTaskStartApiError extends ApiError {
  readonly blockers: readonly TaskBlockerDto[];

  constructor(
    message: string,
    blockers: readonly TaskBlockerDto[],
    body: unknown
  ) {
    super(message, 400, body);
    this.name = 'BlockedTaskStartApiError';
    this.blockers = blockers;
  }
}

/** A request was attempted while VITE_API_URL is not configured. */
export class ApiConfigurationError extends Error {
  constructor() {
    super('VITE_API_URL is not set. Copy frontend/.env.example to frontend/.env and set it.');
    this.name = 'ApiConfigurationError';
  }
}
