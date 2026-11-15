import type { TaskPriority } from '../models';
import type { IValidator, ValidationResult } from './IValidator';

export interface TaskEditorInput {
  readonly title: string;
  readonly description?: string | null;
  readonly priority?: TaskPriority | null;
  readonly startDate?: string | null;
  readonly dueDate?: string | null;
}

export interface TaskEditorValidationErrors {
  readonly title?: string;
  readonly dueDate?: string;
  readonly general?: string;
}

export class TaskEditorValidator implements IValidator<TaskEditorInput, TaskEditorValidationErrors> {
  validate(input: TaskEditorInput): ValidationResult<TaskEditorValidationErrors> {
    const errors: Record<string, string> = {};

    const trimmedTitle = input.title ? input.title.trim() : '';
    if (!trimmedTitle) {
      errors.title = 'Title is required.';
    } else if (trimmedTitle.length > 200) {
      errors.title = 'Title cannot be longer than 200 characters.';
    }

    if (input.startDate && input.dueDate) {
      const start = new Date(input.startDate).getTime();
      const due = new Date(input.dueDate).getTime();

      if (!isNaN(start) && !isNaN(due) && due < start) {
        errors.dueDate = 'Due date must be on or after the start date.';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

export const taskEditorValidator = new TaskEditorValidator();
