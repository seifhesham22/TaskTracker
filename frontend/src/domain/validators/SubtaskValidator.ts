import type { IValidator, ValidationResult } from './IValidator';
import type { SubtaskEditorInput, SubtaskValidationErrors } from '../models';

export class SubtaskValidator implements IValidator<SubtaskEditorInput, SubtaskValidationErrors> {
  static readonly MAX_TITLE_LENGTH = 200;

  validate(input: SubtaskEditorInput): ValidationResult<SubtaskValidationErrors> {
    const errors: SubtaskValidationErrors = {};
    const trimmedTitle = input.title?.trim() ?? '';

    if (!trimmedTitle) {
      return {
        isValid: false,
        errors: {
          title: 'Subtask title is required.',
        },
      };
    }

    if (trimmedTitle.length > SubtaskValidator.MAX_TITLE_LENGTH) {
      return {
        isValid: false,
        errors: {
          title: `Subtask title must be at most ${SubtaskValidator.MAX_TITLE_LENGTH} characters.`,
        },
      };
    }

    return {
      isValid: true,
      errors,
    };
  }
}
