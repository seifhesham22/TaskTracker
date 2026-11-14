import type { RegisterInput } from '../../api/services/AuthService';

export interface FieldErrors {
  readonly email?: string;
  readonly password?: string;
}

export interface IValidator<TInput, TErrors> {
  validate(input: TInput): TErrors;
}

/**
 * Validates registration input fields according to US-1 requirements:
 * - Email: required, valid email format
 * - Password: required
 */
export class RegistrationValidator implements IValidator<RegisterInput, FieldErrors> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validate(input: RegisterInput): FieldErrors {
    const errors: Record<string, string> = {};
    const trimmedEmail = input.email ? input.email.trim() : '';

    if (!trimmedEmail) {
      errors.email = 'Email is required.';
    } else if (!RegistrationValidator.EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Enter a valid email address.';
    }

    if (!input.password) {
      errors.password = 'Password is required.';
    }

    return errors as FieldErrors;
  }
}
