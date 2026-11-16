import type { TaskDependencyRef } from '../models';

export interface DependencyValidationResult {
  readonly isValid: boolean;
  readonly error?: string;
}

export class TaskDependencyValidator {
  public validateSelection(
    currentTaskId: string,
    selectedTaskId: string | null | undefined,
    existingDependencies: readonly (TaskDependencyRef | { id: string })[] = []
  ): DependencyValidationResult {
    if (!selectedTaskId || selectedTaskId.trim() === '') {
      return {
        isValid: false,
        error: 'Select a task to continue.',
      };
    }

    if (selectedTaskId === currentTaskId) {
      return {
        isValid: false,
        error: "A task can't block itself.",
      };
    }

    const alreadyExists = existingDependencies.some((dep) => dep.id === selectedTaskId);
    if (alreadyExists) {
      return {
        isValid: false,
        error: 'This dependency already exists.',
      };
    }

    return { isValid: true };
  }

  public formatDirectionDescription(
    predecessor: { readableId: string; title: string },
    dependent: { readableId: string; title?: string }
  ): string {
    return `${predecessor.readableId} · ${predecessor.title} ↓ must happen before ${dependent.readableId}`;
  }
}

export const taskDependencyValidator = new TaskDependencyValidator();
