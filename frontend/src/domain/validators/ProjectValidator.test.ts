import { describe, expect, it } from 'vitest';
import { ProjectValidator } from './ProjectValidator';

describe('ProjectValidator', () => {
  const validator = new ProjectValidator();

  it('rejects an empty name with "Enter a project name."', () => {
    const result = validator.validate({ name: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe('Enter a project name.');
  });

  it('rejects whitespace-only names with "Enter a project name."', () => {
    const result = validator.validate({ name: '    ' });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe('Enter a project name.');
  });

  it('accepts a valid project name', () => {
    const result = validator.validate({ name: 'Website redesign' });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('accepts names with leading and trailing whitespace if non-empty when trimmed', () => {
    const result = validator.validate({ name: '  Product Launch  ' });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
