import type { CreateTaskInput, Task, UpdateTaskChanges } from '../domain/models';
import { TASK_FIELDS, toTask, type TaskNode } from './boards';
import { graphqlRequest } from './graphql';

export const CREATE_TASK_MUTATION = `
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      readableId
      number
      boardId
      title
      description
      status
      columnId
      columnName
      priority
      assigneeIds
      dueDate
      createdAt
      parentTaskId
    }
  }
`;

export const MOVE_TASK_MUTATION = `
  mutation MoveTask($input: MoveTaskInput!) {
    moveTask(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

export const UPDATE_TASK_MUTATION = `
  mutation UpdateTask($input: UpdateTaskInput!) {
    updateTask(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

export function toMutationInput(input: CreateTaskInput): Record<string, unknown> {
  const result: Record<string, unknown> = { boardId: input.boardId, title: input.title };
  if (input.columnId) result.columnId = input.columnId;
  if (input.description) result.description = input.description;
  if (input.assigneeId) result.assigneeId = input.assigneeId;
  if (input.priority) result.priority = input.priority;
  if (input.dueDate) result.dueDate = input.dueDate;
  if (input.parentTaskId) result.parentTaskId = input.parentTaskId;
  return result;
}

export async function createTaskRequest(input: CreateTaskInput): Promise<Task> {
  const data = await graphqlRequest<{ createTask: Task }>(CREATE_TASK_MUTATION, {
    input: toMutationInput(input),
  });
  return data.createTask;
}

export async function moveTaskRequest(taskId: string, columnId: string): Promise<Task> {
  const data = await graphqlRequest<{ moveTask: TaskNode }>(MOVE_TASK_MUTATION, {
    input: { taskId, columnId },
  });
  return toTask(data.moveTask);
}

/** Sends only the fields in `changes`, so fields the user didn't touch keep their saved values. */
export async function updateTaskRequest(taskId: string, changes: UpdateTaskChanges): Promise<Task> {
  const data = await graphqlRequest<{ updateTask: TaskNode }>(UPDATE_TASK_MUTATION, {
    input: { taskId, ...changes },
  });
  return toTask(data.updateTask);
}

/**
 * US-12: the backend's `assignTask` and `unassignTask` (AssignTaskHandler, UnassignTaskHandler).
 * Owners and Writers only (AUTH_NOT_AUTHORIZED otherwise); assigning someone who isn't a member of
 * the task's project is refused (BAD_USER_INPUT). Both return the task as saved, with its assignees.
 */
export const ASSIGN_TASK_MUTATION = `
  mutation AssignTask($input: AssignTaskInput!) {
    assignTask(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

export const UNASSIGN_TASK_MUTATION = `
  mutation UnassignTask($input: UnassignTaskInput!) {
    unassignTask(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

export async function assignTaskRequest(taskId: string, userId: string): Promise<Task> {
  const data = await graphqlRequest<{ assignTask: TaskNode }>(ASSIGN_TASK_MUTATION, { input: { taskId, userId } });
  return toTask(data.assignTask);
}

export async function unassignTaskRequest(taskId: string, userId: string): Promise<Task> {
  const data = await graphqlRequest<{ unassignTask: TaskNode }>(UNASSIGN_TASK_MUTATION, { input: { taskId, userId } });
  return toTask(data.unassignTask);
}
