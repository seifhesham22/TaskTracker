const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "YYYY-MM-DD" of a local calendar date. */
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Due dates are calendar dates; the backend example sends them as midnight UTC. */
export function dateKeyToIso(dateKey: string): string {
  return `${dateKey}T00:00:00Z`;
}

export function isoToDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Local Date for a "YYYY-MM-DD" key (for the date picker). */
export function dateKeyToDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Nov 3", plus the year when it isn't the current year (designer: Data → UI). */
export function formatDueDate(dateKey: string, today: Date = new Date()): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const label = `${MONTHS[m - 1]} ${d}`;
  return y === today.getFullYear() ? label : `${label}, ${y}`;
}

/** "Nov 3, 2026": used in the form, where the year is always shown. */
export function formatFullDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Overdue = due date before today; Done tasks are never overdue. */
export function isOverdue(dueIso: string | null, status: string, today: Date = new Date()): boolean {
  if (!dueIso || status === 'DONE') return false;
  return isoToDateKey(dueIso) < toDateKey(today);
}

/** "Demo Admin" -> "DA", "admin@local.test" -> "AD". */
export function initials(name: string): string {
  const base = name.includes('@') ? name.split('@')[0] : name;
  const words = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}
