/** Date-only FU rules. No holidays: Monday through Friday only. */
export function fuDate(value: string | Date): Date {
  const day = value instanceof Date
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
    : value.length === 10 ? value : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}
export function fuDay(value: string | Date): string {
  const date = typeof value === 'string' ? fuDate(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function nextFuWeekday(value: string | Date): Date {
  const day = typeof value === 'string' ? fuDate(value) : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1);
  return day;
}
export function addFuBusinessDays(value: string | Date, days: number): Date {
  const date = typeof value === 'string' ? fuDate(value) : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  for (let count = 0; count < days;) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) count++;
  }
  return nextFuWeekday(date);
}
export function diffFuBusinessDays(from: string | Date, to: string | Date): number {
  const start = typeof from === 'string' ? fuDate(from) : new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = typeof to === 'string' ? fuDate(to) : new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (end < start) return -diffFuBusinessDays(end, start);
  let count = 0;
  while (start < end) {
    start.setDate(start.getDate() + 1);
    if (start.getDay() !== 0 && start.getDay() !== 6) count++;
  }
  return count;
}
export function effectiveFuDay(value: string): string { return fuDay(nextFuWeekday(value)); }
export function fuWeekKey(value: string): string {
  const day = nextFuWeekday(value);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return fuDay(day);
}