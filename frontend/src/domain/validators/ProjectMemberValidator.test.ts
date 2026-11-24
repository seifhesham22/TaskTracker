import { describe, expect, it } from 'vitest';
import { ProjectRole } from '../models';
import { projectMemberValidator } from './ProjectMemberValidator';

describe('ProjectMemberValidator', () => {
  it('rejects empty or whitespace-only email', () => {
    const emptyResult = projectMemberValidator.validate({
      projectId: 'proj-1',
      email: '',
      role: ProjectRole.Writer,
    });
    expect(emptyResult.isValid).toBe(false);
    expect(emptyResult.errors.email).toBe('Enter an account email or name.');

    const spaceResult = projectMemberValidator.validate({
      projectId: 'proj-1',
      email: '   ',
      role: ProjectRole.Writer,
    });
    expect(spaceResult.isValid).toBe(false);
    expect(spaceResult.errors.email).toBe('Enter an account email or name.');
  });

  it('rejects invalid role if supplied', () => {
    const result = projectMemberValidator.validate({
      projectId: 'proj-1',
      email: 'user@example.com',
      // @ts-expect-error testing invalid role
      role: 'INVALID_ROLE',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.role).toBe('Choose a valid project role.');
  });

  it('accepts valid input with role', () => {
    const result = projectMemberValidator.validate({
      projectId: 'proj-1',
      email: 'user@example.com',
      role: ProjectRole.Owner,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
