const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateKeyToIso(dateKey: string): string {
  return `${dateKey}T00:00:00Z`;
}

export function isoToDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function dateKeyToDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDueDate(dateKey: string, today: Date = new Date()): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const label = `${MONTHS[m - 1]} ${d}`;
  return y === today.getFullYear() ? label : `${label}, ${y}`;
}

export function formatFullDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function isOverdue(dueIso: string | null, status: string, today: Date = new Date()): boolean {
  if (!dueIso || status === 'DONE') return false;
  return isoToDateKey(dueIso) < toDateKey(today);
}

export function initials(name: string): string {
  const base = name.includes('@') ? name.split('@')[0] : name;
  const words = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const word = words[0] ?? '?';
  const trailingDigit = /\d$/.test(word) ? word.slice(-1) : word.slice(1, 2);
  return (word[0] + trailingDigit).toUpperCase();
}
