// Mapeia jobname -> canal (D-API operacional / Z-API comercial)
export type Canal = 'operacional' | 'operacional2' | 'comercial' | 'outro';

// Jobs que já foram migrados para o novo chip DAPI OPERACIONAL
const OPERACIONAL2_JOBS = new Set<string>([]);

const COMERCIAL_JOBS = new Set([
  'confirmacao-experimental-cada-15min',
  'send-follow-ups-automaticos-daily',
  'healthcheck-follow-ups-diario',
  'notify-boas-vindas-matricula-every-30min',
  'notify-feedback-experimental-30min',
  'notify-rotinas-every-15min',
  'retry-anamneses-pendentes-5min',
]);

const OPERACIONAL_JOBS = new Set([
  'daily-crm-backup-secured',
  'notify-resumo-semanal-crm-sab-18h',
  'notify-task-deadlines',
  'resumo-gestao-operacional-diario-0800',
  'resumo-semanal-pergunta-sabado-10h',
  'resumo-semanal-pergunta-segunda-10h',
  'send-cronograma-messages-every-3min',
  'send-formulario-lembretes-every-15min',
]);

export function getCanal(jobname: string): Canal {
  if (OPERACIONAL2_JOBS.has(jobname)) return 'operacional2';
  if (COMERCIAL_JOBS.has(jobname)) return 'comercial';
  if (OPERACIONAL_JOBS.has(jobname)) return 'operacional';
  return 'outro';
}

// Nomes amigáveis para jobs do pg_cron
const JOB_LABELS: Record<string, { label: string; desc?: string }> = {
  // Operacional (D-API)
  'daily-crm-backup-secured': { label: 'Backup diário do CRM', desc: 'Cópia de segurança de todos os dados' },
  'notify-boas-vindas-matricula-every-30min': { label: 'Boas-vindas a novos matriculados', desc: 'Envia mensagem de boas-vindas após matrícula' },
  'notify-feedback-experimental-30min': { label: 'Feedback pós-experimental', desc: 'Solicita feedback após aula experimental' },
  'notify-resumo-semanal-crm-sab-18h': { label: 'Resumo semanal do CRM', desc: 'Consolidado da semana enviado no sábado' },
  'notify-rotinas-every-15min': { label: 'Lembretes de rotinas', desc: 'Notifica rotinas do dia aos responsáveis' },
  'notify-task-deadlines': { label: 'Prazos de tarefas', desc: 'Alerta tarefas vencendo ou vencidas' },
  'resumo-gestao-operacional-diario-0800': { label: 'Resumo diário — Gestão Operacional', desc: 'Panorama enviado toda manhã às 08h' },
  'resumo-semanal-pergunta-sabado-10h': { label: 'Pergunta semanal (sábado)', desc: 'Pergunta de fechamento no grupo' },
  'resumo-semanal-pergunta-segunda-10h': { label: 'Pergunta semanal (segunda)', desc: 'Pergunta de abertura no grupo' },
  'retry-anamneses-pendentes-5min': { label: 'Reenvio de anamneses pendentes', desc: 'Tenta reenviar anamneses que falharam' },
  'send-cronograma-messages-every-3min': { label: 'Envio do cronograma operacional', desc: 'Dispara atividades programadas do dia' },
  'send-formulario-lembretes-every-15min': { label: 'Lembretes de formulários', desc: 'Cobra formulários (encerramento, etc.)' },
  // Comercial (Z-API)
  'confirmacao-experimental-cada-15min': { label: 'Confirmação de aula experimental', desc: 'Confirma presença 24h e 2h antes' },
  'send-follow-ups-automaticos-daily': { label: 'Follow-ups automáticos', desc: 'Envia FUs D+1/D+7/D+15/D+30 seg–sex 09h' },
  'healthcheck-follow-ups-diario': { label: 'Auditoria dos follow-ups', desc: 'Verifica se os FUs foram enviados' },
};

export function getJobLabel(jobname: string): string {
  return JOB_LABELS[jobname]?.label ?? jobname;
}

export function getJobDescription(jobname: string): string | undefined {
  return JOB_LABELS[jobname]?.desc;
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
