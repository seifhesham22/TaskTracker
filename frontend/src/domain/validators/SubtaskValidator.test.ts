import { describe, expect, it } from 'vitest';
import { SubtaskValidator } from './SubtaskValidator';

describe('SubtaskValidator', () => {
  const validator = new SubtaskValidator();

  it('fails validation when title is empty', () => {
    const result = validator.validate({ title: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBe('Subtask title is required.');
  });

  it('fails validation when title is whitespace only', () => {
    const result = validator.validate({ title: '   ' });
    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBe('Subtask title is required.');
  });

  it('fails validation when title exceeds maximum length', () => {
    const longTitle = 'a'.repeat(201);
    const result = validator.validate({ title: longTitle });
    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBe('Subtask title must be at most 200 characters.');
  });

  it('passes validation when title is valid', () => {
    const result = validator.validate({ title: 'Prepare the release notes' });
    expect(result.isValid).toBe(true);
    expect(result.errors.title).toBeUndefined();
  });

  it('passes validation when title has leading or trailing spaces but non-empty trimmed', () => {
    const result = validator.validate({ title: '   Valid title   ' });
    expect(result.isValid).toBe(true);
  });
});
