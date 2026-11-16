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

  it('parses circular dependency error from backend with existing path and rejected link', () => {
    const rawBackendMessage =
      "TES-27 can't block TES-24: TES-24 already blocks TES-27 (TES-24 → TES-27), so this would create a cycle.";
    const cycleInfo = validator.parseCycleError(rawBackendMessage, 'TES-27', 'TES-24');

    expect(cycleInfo).not.toBeNull();
    expect(cycleInfo?.isCycle).toBe(true);
    expect(cycleInfo?.title).toBe('This dependency creates a cycle.');
    expect(cycleInfo?.message).toBe('TES-27 already depends on TES-24. Choose another task.');
    expect(cycleInfo?.existingPath).toBe('TES-24 → TES-27');
    expect(cycleInfo?.rejectedLink).toBe('TES-27 → TES-24');
  });

  it('returns null when error is not related to cycles', () => {
    const cycleInfo = validator.parseCycleError('Task was not found.', 'TES-27', 'TES-24');
    expect(cycleInfo).toBeNull();
  });
});
