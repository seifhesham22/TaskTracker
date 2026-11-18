import { TITLE_REQUIRED, TITLE_TOO_LONG, toCreateTaskFailure, validateTitle } from './createTaskErrors';
import { TITLE_MAX_LENGTH, type CreateTaskInput, type Task } from './models';

// Wording from the designer's Create subtask handoff.
export const SUBTASK_TITLE_REQUIRED = 'Subtask title is required.';
export const SUBTASK_TITLE_TOO_LONG = `Subtask title can’t be longer than ${TITLE_MAX_LENGTH} characters.`;
export const SUBTASK_CREATE_FAILED = 'We couldn’t create the subtask. Try again.';
export const PARENT_GONE = 'The parent task no longer exists, so the subtask can’t be added to it.';

export interface SubtaskErrors {
  title?: string;
  form?: string;
}

const subtaskTitleMessage = (message: string) =>
  message === TITLE_REQUIRED ? SUBTASK_TITLE_REQUIRED : message === TITLE_TOO_LONG ? SUBTASK_TITLE_TOO_LONG : message;

/** The backend's title rule (TaskItem.Rename): 1–200 characters after trimming. */
export function validateSubtaskTitle(title: string): string | null {
  const error = validateTitle(title);
  return error ? subtaskTitleMessage(error) : null;
}

// CreateTaskHandler's parent checks.
const PARENT_NOT_FOUND = /^Parent task '[^']+' was not found\.$/;

/** Turns a failed createTask into the form's messages, reusing the create-task error mapping. */
export function toSubtaskErrors(error: unknown, input: CreateTaskInput): SubtaskErrors {
  const failure = toCreateTaskFailure(error, input);
  if (failure.kind === 'fields') {
    return failure.fields.title ? { title: subtaskTitleMessage(failure.fields.title) } : { form: SUBTASK_CREATE_FAILED };
  }
  if (failure.kind === 'boardNotFound') return { form: PARENT_GONE };
  if (failure.reason === 'rejected') {
    // NOT_FOUND / BAD_USER_INPUT with the backend's own explanation, e.g. a parent in another project.
    return { form: PARENT_NOT_FOUND.test(failure.error.description) ? PARENT_GONE : failure.error.description };
  }
  if (failure.reason === 'configuration') return { form: failure.error.description };
  return { form: SUBTASK_CREATE_FAILED };
}

export const isDone = (task: Task) => task.status === 'DONE';
