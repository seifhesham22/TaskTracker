import { describe, expect, it } from 'vitest';
import { TaskPriority } from '../models';
import { TaskEditorValidator } from './TaskEditorValidator';

describe('TaskEditorValidator', () => {
  const validator = new TaskEditorValidator();

  it('validates a valid task input', () => {
    const result = validator.validate({
      title: 'Valid Task Title',
      description: 'Some description',
      priority: TaskPriority.High,
      startDate: '2026-11-16',
      dueDate: '2026-11-20',
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects an empty or whitespace-only title', () => {
    const emptyResult = validator.validate({ title: '' });
    expect(emptyResult.isValid).toBe(false);
    expect(emptyResult.errors.title).toBe('Title is required.');

    const spaceResult = validator.validate({ title: '   ' });
    expect(spaceResult.isValid).toBe(false);
    expect(spaceResult.errors.title).toBe('Title is required.');
  });

  it('rejects a title longer than 200 characters', () => {
    const longTitle = 'a'.repeat(201);
    const result = validator.validate({ title: longTitle });

    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBe('Title cannot be longer than 200 characters.');
  });

  it('accepts title with exactly 200 characters', () => {
    const validLongTitle = 'a'.repeat(200);
    const result = validator.validate({ title: validLongTitle });

    expect(result.isValid).toBe(true);
    expect(result.errors.title).toBeUndefined();
  });

  it('rejects when dueDate is earlier than startDate', () => {
    const result = validator.validate({
      title: 'Date check task',
      startDate: '2026-11-16',
      dueDate: '2026-11-14',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.dueDate).toBe('Due date must be on or after the start date.');
  });

  it('accepts when dueDate is on the same day as startDate', () => {
    const result = validator.validate({
      title: 'Same day dates',
      startDate: '2026-11-16',
      dueDate: '2026-11-16',
    });

    expect(result.isValid).toBe(true);
    expect(result.errors.dueDate).toBeUndefined();
  });

  it('accepts when only startDate or only dueDate is provided', () => {
    const withStartOnly = validator.validate({
      title: 'Start only',
      startDate: '2026-11-16',
    });
    expect(withStartOnly.isValid).toBe(true);

    const withDueOnly = validator.validate({
      title: 'Due only',
      dueDate: '2026-11-20',
    });
    expect(withDueOnly.isValid).toBe(true);
  });
});
