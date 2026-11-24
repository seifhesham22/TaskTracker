import type { IValidator, ValidationResult } from './IValidator';
import type { CreateProjectInput, ProjectValidationErrors } from '../models';

export class ProjectValidator implements IValidator<CreateProjectInput, ProjectValidationErrors> {
  validate(input: CreateProjectInput): ValidationResult<ProjectValidationErrors> {
    const trimmedName = input.name?.trim() ?? '';

    if (!trimmedName) {
      return {
        isValid: false,
        errors: {
          name: 'Enter a project name.',
        },
      };
    }

    return {
      isValid: true,
      errors: {},
    };
  }
}

export const projectValidator = new ProjectValidator();
