import type { AssignTaskInput, AssigneeValidationErrors, ProjectMemberModel } from '../models';

export interface AssigneeValidationResult {
  readonly isValid: boolean;
  readonly errors: AssigneeValidationErrors;
}

export class TaskAssigneeValidator {
  public validate(
    input: AssignTaskInput,
    members: readonly ProjectMemberModel[] = []
  ): AssigneeValidationResult {
    const errors: { userId?: string; general?: string } = {};

    if (!input.taskId || input.taskId.trim() === '') {
      errors.general = 'Task ID is required.';
    }

    if (!input.userId || input.userId.trim() === '') {
      errors.userId = 'Select a project member to assign.';
    } else {
      const isMember = members.some(
        (m) => m.userId === input.userId || m.userName === input.userId
      );
      if (members.length > 0 && !isMember) {
        errors.userId = 'Only current project members can be assigned to this task.';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }
}

export const taskAssigneeValidator = new TaskAssigneeValidator();
