import type { IValidator, ValidationResult } from './IValidator';
import { ProjectRole, type AddProjectMemberInput, type AddProjectMemberValidationErrors } from '../models';

export class ProjectMemberValidator
  implements IValidator<AddProjectMemberInput, AddProjectMemberValidationErrors>
{
  validate(input: AddProjectMemberInput): ValidationResult<AddProjectMemberValidationErrors> {
    const errors: AddProjectMemberValidationErrors = {};
    const email = input.email?.trim() ?? '';

    if (!email) {
      return {
        isValid: false,
        errors: {
          email: 'Enter an account email or name.',
        },
      };
    }

    if (input.role && !Object.values(ProjectRole).includes(input.role)) {
      return {
        isValid: false,
        errors: {
          role: 'Choose a valid project role.',
        },
      };
    }

    return {
      isValid: true,
      errors,
    };
  }
}

export const projectMemberValidator = new ProjectMemberValidator();
