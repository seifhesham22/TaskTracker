import { describe, expect, it } from 'vitest';
import { LoginValidator } from './LoginValidator';

describe('LoginValidator', () => {
  const validator = new LoginValidator();

  it('fails when email and password are empty', () => {
    const result = validator.validate({ email: '', password: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe('Email is required');
    expect(result.errors.password).toBe('Password is required');
  });

  it('fails when email format is invalid', () => {
    const result = validator.validate({ email: 'notanemail', password: 'validPassword123' });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe('Please enter a valid email address');
    expect(result.errors.password).toBeUndefined();
  });

  it('fails when password is missing', () => {
    const result = validator.validate({ email: 'user@example.com', password: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBeUndefined();
    expect(result.errors.password).toBe('Password is required');
  });

  it('passes when valid email and password are provided', () => {
    const result = validator.validate({ email: 'user@example.com', password: 'secretPassword123' });
    expect(result.isValid).toBe(true);
    expect(result.errors.email).toBeUndefined();
    expect(result.errors.password).toBeUndefined();
  });

  it('trims email before validating', () => {
    const result = validator.validate({ email: '  user@example.com  ', password: 'secretPassword123' });
    expect(result.isValid).toBe(true);
  });
});
