import type { BoardColumn, Task } from './models';

function compareByPosition(a: Task, b: Task): number {
  if (a.position === b.position) return 0;
  if (a.position === undefined) return 1;
  if (b.position === undefined) return -1;
  return a.position < b.position ? -1 : 1;
}

export function groupTasksByColumn(columns: BoardColumn[], tasks: Task[]): Record<string, Task[]> {
  const groups: Record<string, Task[]> = {};
  for (const column of columns) groups[column.id] = [];
  for (const task of tasks) groups[task.columnId]?.push(task);
  for (const group of Object.values(groups)) group.sort(compareByPosition);
  return groups;
}
