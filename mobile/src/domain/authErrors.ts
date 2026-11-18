import { ConfigurationError } from '../api/client';
import { GraphQLResponseError, NetworkError, hasErrorCode } from '../api/graphql';

// Wording from the designer's handoff for the registration and login screens.
export const EMAIL_REQUIRED = 'Email is required.';
export const EMAIL_INVALID = 'Enter a valid email address.';
export const PASSWORD_REQUIRED = 'Password is required.';
export const EMAIL_TAKEN = 'This email is already registered. Log in or use another email.';
export const INVALID_CREDENTIALS = 'Email or password is incorrect. Check your details and try again.';
export const LOGIN_FAILED = 'We couldn’t log you in. Try again.';
export const REGISTER_FAILED = 'We couldn’t create your account. Try again.';
export const NETWORK_FAILED = 'We couldn’t reach the server. Check your connection and try again.';
export const SESSION_EXPIRED = 'Your session has ended. Log in again to continue.';
export const LOGOUT_FAILED = 'We couldn’t confirm logout. Try again.';

export interface AuthFormErrors {
  email?: string;
  password?: string;
  /** Shown above the fields, for errors that belong to no single field. */
  form?: string;
}

// Same check as the web app's validator: something@something.something, no spaces.
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Required fields and email format. Password rules are the backend's, so its message is shown as is. */
export function validateCredentials(email: string, password: string): AuthFormErrors {
  const errors: AuthFormErrors = {};
  const trimmed = email.trim();
  if (!trimmed) errors.email = EMAIL_REQUIRED;
  else if (!EMAIL_FORMAT.test(trimmed)) errors.email = EMAIL_INVALID;
  if (!password) errors.password = PASSWORD_REQUIRED;
  return errors;
}

export const hasErrors = (errors: AuthFormErrors) => !!(errors.email || errors.password || errors.form);

// RegisterHandler's messages (backend/TaskTracker.API/Features/Auth/Register/RegisterHandler.cs).
// Any other BAD_USER_INPUT from register is ASP.NET Identity's password policy.
const DUPLICATE_EMAIL = /^An account with the email '.*' already exists\.$/;
const INVALID_EMAIL = /is not a valid email address\.$/;
const EMAIL_MISSING = /^Email is required\.$/;

export function toRegisterErrors(error: unknown): AuthFormErrors {
  if (error instanceof NetworkError) return { form: NETWORK_FAILED };
  if (error instanceof ConfigurationError) return { form: error.message };
  if (error instanceof GraphQLResponseError && hasErrorCode(error, 'BAD_USER_INPUT')) {
    const message = error.errors.find((e) => e.extensions?.code === 'BAD_USER_INPUT')?.message ?? '';
    if (DUPLICATE_EMAIL.test(message)) return { email: EMAIL_TAKEN };
    if (INVALID_EMAIL.test(message)) return { email: EMAIL_INVALID };
    if (EMAIL_MISSING.test(message)) return { email: EMAIL_REQUIRED };
    if (message) return { password: message };
  }
  return { form: REGISTER_FAILED };
}

export function toLoginErrors(error: unknown): AuthFormErrors {
  // The backend answers a wrong password and an unknown email the same way, and so does the app.
  if (hasErrorCode(error, 'INVALID_CREDENTIALS')) return { form: INVALID_CREDENTIALS };
  if (error instanceof ConfigurationError) return { form: error.message };
  return { form: LOGIN_FAILED };
}
