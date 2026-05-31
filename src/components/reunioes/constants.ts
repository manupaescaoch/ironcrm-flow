export const TIPOS_REUNIAO = [
  'COMERCIAL',
  'OPERACIONAL',
  'COORDENAÇÃO',
  'GERAL',
  'OUTRO',
] as const;

export type TipoReuniao = (typeof TIPOS_REUNIAO)[number];

export const STATUS_REUNIAO = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'arquivada', label: 'Arquivada' },
] as const;

export type StatusReuniao = (typeof STATUS_REUNIAO)[number]['value'];

export const STATUS_ENCAMINHAMENTO = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'atrasado', label: 'Atrasado' },
] as const;

export type StatusEncaminhamento = (typeof STATUS_ENCAMINHAMENTO)[number]['value'];

export const NUMEROS_PERIODO_CAMPOS = [
  { key: 'leads', label: 'Leads novos' },
  { key: 'agendamentos', label: 'Agendamentos' },
  { key: 'experimentais', label: 'Experimentais' },
  { key: 'matriculas', label: 'Matrículas' },
  { key: 'faturamento', label: 'Faturamento (R$)' },
  { key: 'cancelamentos', label: 'Cancelamentos' },
] as const;

export type NumerosPeriodo = Partial<Record<(typeof NUMEROS_PERIODO_CAMPOS)[number]['key'], number>>;

export function isEncaminhamentoAtrasado(prazo: string | null, status: string): boolean {
  if (!prazo) return false;
  if (status === 'concluido') return false;
  const [y, m, d] = prazo.split('-').map(Number);
  const prazoDate = new Date(y, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return prazoDate < hoje;
}

export function statusEffetivo(prazo: string | null, status: string): StatusEncaminhamento {
  if (status === 'concluido') return 'concluido';
  if (isEncaminhamentoAtrasado(prazo, status)) return 'atrasado';
  return status as StatusEncaminhamento;
}
