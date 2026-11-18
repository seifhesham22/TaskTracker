import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NetworkError } from '../api/graphql';
import { TITLE_REQUIRED, TITLE_TOO_LONG, validateTitle } from './createTaskErrors';
import { dateKeyToIso, isoToDateKey } from './format';
import type { Task, TaskPriority, UpdateTaskChanges } from './models';

// Wording from the designer's Edit task handoff.
export const DUE_BEFORE_START = 'Due date must be on or after the start date.';
export const INVALID_DATE = 'Enter a valid date.';
export const SAVE_FAILED = 'We couldn’t save your changes. Try again.';
export const TASK_GONE = 'This task no longer exists. Go back to the board to see its current tasks.';

/** The form's values. Dates are day keys (`YYYY-MM-DD`), as in the create-task form. */
export interface EditTaskValues {
  title: string;
  description: string;
  priority: TaskPriority | null;
  startDate: string | null;
  dueDate: string | null;
}

export type EditTaskField = 'title' | 'startDate' | 'dueDate';

export type EditTaskErrors = Partial<Record<EditTaskField, string>> & { form?: string };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** A day key for a real calendar day, so 2026-02-30 is refused. */
export function isValidDateKey(key: string): boolean {
  if (!DATE_KEY.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function valuesFromTask(task: Task): EditTaskValues {
  return {
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    startDate: task.startDate ? isoToDateKey(task.startDate) : null,
    dueDate: task.dueDate ? isoToDateKey(task.dueDate) : null,
  };
}

/**
 * The backend's rules (TaskItem.Rename and SetDates): a title of 1–200 characters after trimming,
 * and a due date that isn't before the start date. Both dates are optional.
 */
export function validateEditTask(values: EditTaskValues): EditTaskErrors {
  const errors: EditTaskErrors = {};
  const title = validateTitle(values.title);
  if (title) errors.title = title;
  if (values.startDate && !isValidDateKey(values.startDate)) errors.startDate = INVALID_DATE;
  if (values.dueDate && !isValidDateKey(values.dueDate)) errors.dueDate = INVALID_DATE;
  if (!errors.startDate && !errors.dueDate && values.startDate && values.dueDate && values.dueDate < values.startDate) {
    errors.dueDate = DUE_BEFORE_START;
  }
  return errors;
}

/** What to send: only the fields that differ from the saved task, with the backend's formats. */
export function changesFrom(saved: EditTaskValues, values: EditTaskValues): UpdateTaskChanges {
  const changes: UpdateTaskChanges = {};
  const title = values.title.trim();
  if (title !== saved.title) changes.title = title;
  const description = values.description.trim();
  if (description !== saved.description.trim()) changes.description = description || null;
  if (values.priority !== saved.priority) changes.priority = values.priority;
  if (values.startDate !== saved.startDate) changes.startDate = values.startDate ? dateKeyToIso(values.startDate) : null;
  if (values.dueDate !== saved.dueDate) changes.dueDate = values.dueDate ? dateKeyToIso(values.dueDate) : null;
  return changes;
}

export const hasChanges = (changes: UpdateTaskChanges) => Object.keys(changes).length > 0;

// The backend's messages (TaskItem.cs).
const TITLE_EMPTY = /^Title cannot be empty/;
const TITLE_LONG = /^Title cannot be longer than/;
const DATES_OUT_OF_ORDER = /^The due date cannot be before the start date\.$/;
const TASK_NOT_FOUND = /^Task '[^']+' was not found\.$/;

export function toEditTaskErrors(error: unknown): EditTaskErrors {
  if (error instanceof GraphQLResponseError) {
    const errors: EditTaskErrors = {};
    for (const entry of error.errors) {
      const message = entry.message ?? '';
      const code = entry.extensions?.code;
      if (code === 'BAD_USER_INPUT' && TITLE_EMPTY.test(message)) errors.title ??= TITLE_REQUIRED;
      else if (code === 'BAD_USER_INPUT' && TITLE_LONG.test(message)) errors.title ??= TITLE_TOO_LONG;
      else if (code === 'BAD_USER_INPUT' && DATES_OUT_OF_ORDER.test(message)) errors.dueDate ??= DUE_BEFORE_START;
      else if (code === 'NOT_FOUND' && TASK_NOT_FOUND.test(message)) errors.form ??= TASK_GONE;
      else if (code === 'BAD_USER_INPUT' && message) errors.form ??= message;
      else errors.form ??= SAVE_FAILED;
    }
    return errors;
  }
  if (error instanceof ConfigurationError) return { form: error.message };
  if (error instanceof NetworkError) return { form: SAVE_FAILED };
  return { form: SAVE_FAILED };
}
