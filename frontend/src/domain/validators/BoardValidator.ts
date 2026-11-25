import type { IValidator, ValidationResult } from './IValidator';
import type { CreateBoardInput, BoardValidationErrors } from '../models';

export class BoardValidator implements IValidator<CreateBoardInput, BoardValidationErrors> {
  validate(input: CreateBoardInput): ValidationResult<BoardValidationErrors> {
    const trimmedName = input.name?.trim() ?? '';

    if (!trimmedName) {
      return {
        isValid: false,
        errors: {
          name: 'Enter a board name.',
        },
      };
    }

    if (trimmedName.length > 100) {
      return {
        isValid: false,
        errors: {
          name: 'Board name cannot be longer than 100 characters.',
        },
      };
    }

    return {
      isValid: true,
      errors: {},
    };
  }
}

export const boardValidator = new BoardValidator();
