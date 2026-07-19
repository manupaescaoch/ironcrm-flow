// Mapeia jobname -> canal (D-API operacional / Z-API comercial)
export type Canal = 'operacional' | 'comercial' | 'outro';

const COMERCIAL_JOBS = new Set([
  'confirmacao-experimental-cada-15min',
  'send-follow-ups-automaticos-daily',
  'healthcheck-follow-ups-diario',
]);

const OPERACIONAL_JOBS = new Set([
  'daily-crm-backup-secured',
  'notify-boas-vindas-matricula-every-30min',
  'notify-feedback-experimental-30min',
  'notify-resumo-semanal-crm-sab-18h',
  'notify-rotinas-every-15min',
  'notify-task-deadlines',
  'resumo-gestao-operacional-diario-0800',
  'resumo-semanal-pergunta-sabado-10h',
  'resumo-semanal-pergunta-segunda-10h',
  'retry-anamneses-pendentes-5min',
  'send-cronograma-messages-every-3min',
  'send-formulario-lembretes-every-15min',
]);

export function getCanal(jobname: string): Canal {
  if (COMERCIAL_JOBS.has(jobname)) return 'comercial';
  if (OPERACIONAL_JOBS.has(jobname)) return 'operacional';
  return 'outro';
}

// Converte cron UTC para BRT (UTC-3) apenas quando dá — para exibição amigável
export function scheduleToBRT(schedule: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;
  const [min, hour, dom, mon, dow] = parts;
  // Não converte se hora tem lista/range/step
  if (!/^\d+$/.test(hour)) return `${schedule} (UTC)`;
  const h = (parseInt(hour) - 3 + 24) % 24;
  return `${min} ${h} ${dom} ${mon} ${dow} (BRT)`;
}

export function humanizeSchedule(schedule: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;
  const [min, hour, dom, mon, dow] = parts;

  // A cada N minutos
  const stepMin = min.match(/^\*\/(\d+)$/);
  if (stepMin && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `A cada ${stepMin[1]} minutos`;
  }

  // Hora fixa
  if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
    const hBrt = (parseInt(hour) - 3 + 24) % 24;
    const hh = String(hBrt).padStart(2, '0');
    const mm = String(min).padStart(2, '0');
    const dias: Record<string, string> = {
      '*': 'todos os dias',
      '1-5': 'seg–sex',
      '1': 'seg',
      '2': 'ter',
      '3': 'qua',
      '4': 'qui',
      '5': 'sex',
      '6': 'sáb',
      '0': 'dom',
    };
    const diaLabel = dias[dow] ?? `dow=${dow}`;
    return `${hh}:${mm} BRT — ${diaLabel}`;
  }

  return schedule;
}

export const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];
