export function recifeDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function isManagerFuWeekday(now = new Date()): boolean {
  const day = new Date(`${recifeDay(now)}T12:00:00-03:00`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function managerFuStage(enrollment: string, today: string): { tipo: 'G+7' | 'G+30'; atraso: number } | null {
  const days = Math.round((Date.parse(`${today}T12:00:00-03:00`) - Date.parse(`${enrollment.slice(0, 10)}T12:00:00-03:00`)) / 86400000);
  if (!Number.isFinite(days) || days < 7 || days > 45) return null;
  return { tipo: days < 30 ? 'G+7' : 'G+30', atraso: days - (days < 30 ? 7 : 30) };
}

export function suppressManagerFu(rows: { status: string; data_prevista: string | null }[], today: string): boolean {
  return rows.some(row => row.status === 'concluido' || (row.status === 'pendente' && !!row.data_prevista && Date.parse(row.data_prevista) > Date.parse(`${today}T00:00:00-03:00`)));
}