const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';
const BRASILIA_UTC_OFFSET = '-03:00';

type DateInput = string | Date | null | undefined;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getFormatterParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRASILIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

export function getBrasiliaReferenceDate(date: Date = new Date()): Date {
  const parts = getFormatterParts(date);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function getTodayInBrasilia(date: Date = new Date()): string {
  const parts = getFormatterParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function formatDateLocal(date: Date): string {
  if (!isValidDate(date)) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function extractDateOnlyValue(value: DateInput): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (!isValidDate(value)) return null;
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  const trimmed = value.trim();
  const directMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) return directMatch[1];

  const parsed = new Date(trimmed);
  if (!isValidDate(parsed)) return null;
  return getTodayInBrasilia(parsed);
}

export function formatDateOnly(value: DateInput): string {
  const dateOnly = extractDateOnlyValue(value);
  if (!dateOnly) return '-';

  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
}

export function formatTimeValue(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '--:--';
}

export function formatTimestampInBrasilia(value: DateInput, options?: { dateOnly?: boolean; includeSeconds?: boolean }): string {
  if (!value) return '-';

  const parsed = value instanceof Date ? value : new Date(value);
  if (!isValidDate(parsed)) return typeof value === 'string' ? value : '-';

  const parts = getFormatterParts(parsed);
  const datePart = `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
  if (options?.dateOnly) return datePart;

  const timePart = options?.includeSeconds
    ? `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`
    : `${pad2(parts.hour)}:${pad2(parts.minute)}`;

  return `${datePart} ${timePart}`;
}

export function getCurrentHourInBrasilia(date: Date = new Date()): number {
  return getFormatterParts(date).hour;
}

export function getCurrentMinuteInBrasilia(date: Date = new Date()): number {
  return getFormatterParts(date).minute;
}

export function getBrasiliaDayOfWeek(date: Date = new Date()): number {
  return getBrasiliaReferenceDate(date).getDay();
}

export function getBrasiliaDayBounds(dateOnly: string): { start: string; end: string } {
  return {
    start: `${dateOnly}T00:00:00${BRASILIA_UTC_OFFSET}`,
    end: `${dateOnly}T23:59:59${BRASILIA_UTC_OFFSET}`,
  };
}

/**
 * Converte string DATE ("YYYY-MM-DD") em Date local, evitando o bug onde
 * `new Date("2026-06-01")` é interpretado como UTC e exibido como 31/05 em
 * Brasília (-03h). Use SEMPRE para colunas do tipo DATE do Postgres.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [datePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}