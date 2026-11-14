import type { IValidator, ValidationResult } from './IValidator';

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface LoginValidationErrors {
  readonly email?: string;
  readonly password?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class LoginValidator implements IValidator<LoginInput, LoginValidationErrors> {
  validate(input: LoginInput): ValidationResult<LoginValidationErrors> {
    const errors: Record<string, string> = {};

    const trimmedEmail = input.email.trim();
    if (!trimmedEmail) {
      errors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!input.password) {
      errors.password = 'Password is required';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

export const loginValidator = new LoginValidator();
