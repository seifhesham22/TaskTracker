import { describe, expect, it } from 'vitest';
import { RegistrationValidator } from './RegistrationValidator';

describe('RegistrationValidator', () => {
  const validator = new RegistrationValidator();

  it('returns errors when both fields are empty', () => {
    const errors = validator.validate({ email: '', password: '' });
    expect(errors.email).toBe('Email is required.');
    expect(errors.password).toBe('Password is required.');
  });

  it('returns errors when email contains only whitespace', () => {
    const errors = validator.validate({ email: '   ', password: 'ValidPassword1!' });
    expect(errors.email).toBe('Email is required.');
    expect(errors.password).toBeUndefined();
  });

  it('returns error when email format is invalid', () => {
    const errors = validator.validate({ email: 'invalid-email', password: 'ValidPassword1!' });
    expect(errors.email).toBe('Enter a valid email address.');
    expect(errors.password).toBeUndefined();
  });

  it('returns error when password is empty', () => {
    const errors = validator.validate({ email: 'user@example.com', password: '' });
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBe('Password is required.');
  });

  it('returns no errors for valid input', () => {
    const errors = validator.validate({ email: 'user@example.com', password: 'ValidPassword1!' });
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBeUndefined();
  });
});
