import type { BoardColumn, Task } from './models';

export interface GroupedTasks {
  byColumn: Record<string, Task[]>;
  unplaced: Task[];
}

function compareByPosition(a: Task, b: Task): number {
  if (a.position === b.position) return 0;
  if (a.position === undefined) return 1;
  if (b.position === undefined) return -1;
  return a.position < b.position ? -1 : 1;
}

export function groupTasksByColumn(columns: BoardColumn[], tasks: Task[]): GroupedTasks {
  const byColumn: Record<string, Task[]> = {};
  const unplaced: Task[] = [];
  for (const column of columns) byColumn[column.id] = [];
  for (const task of tasks) {
    const group = byColumn[task.columnId];
    if (group) group.push(task);
    else unplaced.push(task);
  }
  for (const group of Object.values(byColumn)) group.sort(compareByPosition);
  return { byColumn, unplaced };
}
