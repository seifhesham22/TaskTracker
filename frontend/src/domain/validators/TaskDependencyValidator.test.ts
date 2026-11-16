import { describe, expect, it } from 'vitest';
import { TaskDependencyValidator } from './TaskDependencyValidator';

describe('TaskDependencyValidator', () => {
  const validator = new TaskDependencyValidator();

  it('rejects empty or null selected task', () => {
    const resultNull = validator.validateSelection('task-1', null);
    expect(resultNull.isValid).toBe(false);
    expect(resultNull.error).toBe('Select a task to continue.');

    const resultEmpty = validator.validateSelection('task-1', '   ');
    expect(resultEmpty.isValid).toBe(false);
    expect(resultEmpty.error).toBe('Select a task to continue.');
  });

  it('rejects selecting the task itself', () => {
    const result = validator.validateSelection('task-1', 'task-1');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("A task can't block itself.");
  });

  it('rejects adding an already existing dependency', () => {
    const result = validator.validateSelection('task-1', 'task-2', [{ id: 'task-2' }]);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('This dependency already exists.');
  });

  it('accepts a valid new distinct task', () => {
    const result = validator.validateSelection('task-1', 'task-2', [{ id: 'task-3' }]);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('formats direction description according to Figma specification', () => {
    const description = validator.formatDirectionDescription(
      { readableId: 'TES-18', title: 'Approve scope' },
      { readableId: 'TES-24', title: 'Prepare the project launch' }
    );
    expect(description).toBe('TES-18 · Approve scope ↓ must happen before TES-24');
  });
});
