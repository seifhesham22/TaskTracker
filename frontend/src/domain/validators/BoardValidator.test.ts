import { describe, expect, it } from 'vitest';
import { BoardValidator } from './BoardValidator';

describe('BoardValidator', () => {
  const validator = new BoardValidator();
  const projectId = '01a18766-48a1-7b2e-9c3f-5d6e7f809a1b';

  it('rejects empty board name', () => {
    const result = validator.validate({ projectId, name: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe('Enter a board name.');
  });

  it('rejects whitespace-only board name', () => {
    const result = validator.validate({ projectId, name: '    ' });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe('Enter a board name.');
  });

  it('rejects board name exceeding 100 characters', () => {
    const result = validator.validate({ projectId, name: 'A'.repeat(101) });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe('Board name cannot be longer than 100 characters.');
  });

  it('accepts valid non-empty board name', () => {
    const result = validator.validate({ projectId, name: 'Sprint 3' });
    expect(result.isValid).toBe(true);
    expect(result.errors.name).toBeUndefined();
  });

  it('accepts valid board name with whitespace that trims to valid', () => {
    const result = validator.validate({ projectId, name: '  Sprint 3  ' });
    expect(result.isValid).toBe(true);
    expect(result.errors.name).toBeUndefined();
  });
});
