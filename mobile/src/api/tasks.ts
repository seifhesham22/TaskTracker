import type { CreateTaskInput, Task } from '../domain/models';
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
  return result;
}

export async function createTaskRequest(input: CreateTaskInput): Promise<Task> {
  const data = await graphqlRequest<{ createTask: Task }>(CREATE_TASK_MUTATION, {
    input: toMutationInput(input),
  });
  return data.createTask;
}
