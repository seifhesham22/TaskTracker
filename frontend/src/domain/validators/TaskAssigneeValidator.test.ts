import { describe, expect, it } from 'vitest';
import type { ProjectMemberModel } from '../models';
import { TaskAssigneeValidator } from './TaskAssigneeValidator';

describe('TaskAssigneeValidator', () => {
  const validator = new TaskAssigneeValidator();
  const mockMembers: ProjectMemberModel[] = [
    { userId: 'u-1', userName: 'admin@local.test', role: 'OWNER' },
    { userId: 'u-2', userName: 'writer@local.test', role: 'WRITER' },
    { userId: 'u-3', userName: 'reader@local.test', role: 'READER' },
  ];

  it('validates a valid assignment for an existing project member', () => {
    const result = validator.validate({ taskId: 't-1', userId: 'u-2' }, mockMembers);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects an empty or missing userId', () => {
    const result = validator.validate({ taskId: 't-1', userId: '' }, mockMembers);
    expect(result.isValid).toBe(false);
    expect(result.errors.userId).toBe('Select a project member to assign.');
  });

  it('rejects when assigning a non-member', () => {
    const result = validator.validate({ taskId: 't-1', userId: 'outsider-999' }, mockMembers);
    expect(result.isValid).toBe(false);
    expect(result.errors.userId).toBe('Only current project members can be assigned to this task.');
  });

  it('rejects missing taskId', () => {
    const result = validator.validate({ taskId: '', userId: 'u-1' }, mockMembers);
    expect(result.isValid).toBe(false);
    expect(result.errors.general).toBe('Task ID is required.');
  });
});
