export type ContaStatusBase = 'pendente' | 'paga' | 'cancelada';
export type ContaStatusView = 'pendente' | 'vencendo_hoje' | 'atrasada' | 'paga' | 'cancelada';
export type ContaPrioridade = 'baixa' | 'normal' | 'importante' | 'urgente';
export type ContaFormaPagamento =
  | 'boleto'
  | 'pix'
  | 'transferencia'
  | 'cartao'
  | 'debito_automatico'
  | 'dinheiro'
  | 'outro';

export interface ContaPagar {
  id: string;
  unidade_id: string;
  descricao: string;
  fornecedor: string;
  categoria: string;
  prioridade: ContaPrioridade;
  centro_custo: string | null;
  competencia: string | null;
  observacoes: string | null;
  valor: number;
  data_vencimento: string;
  forma_pagamento: ContaFormaPagamento;
  numero_fatura: string | null;
  codigo_barras: string | null;
  linha_digitavel: string | null;
  chave_pix: string | null;
  codigo_pix: string | null;
  documento_url: string | null;
  status: ContaStatusBase;
  valor_pago: number | null;
  data_pagamento: string | null;
  forma_pagamento_baixa: string | null;
  juros: number;
  multa: number;
  desconto: number;
  comprovante_url: string | null;
  baixa_observacoes: string | null;
  created_by: string | null;
  created_by_nome: string | null;
  baixado_por: string | null;
  baixado_por_nome: string | null;
  baixado_em: string | null;
  cancelado_em: string | null;
  cancelado_por_nome: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContaHistorico {
  id: string;
  conta_id: string;
  acao: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  user_nome: string | null;
  created_at: string;
}

export const CATEGORIAS = [
  'Aluguel',
  'Condomínio',
  'Água',
  'Energia',
  'Internet',
  'Telefone',
  'Folha de pagamento',
  'Encargos',
  'Impostos',
  'Equipamentos',
  'Manutenção',
  'Marketing',
  'Serviços terceirizados',
  'Materiais',
  'Administrativo',
  'Financiamentos',
  'Outros',
];

export const PRIORIDADES: { value: ContaPrioridade; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'importante', label: 'Importante' },
  { value: 'urgente', label: 'Urgente' },
];

export const FORMAS_PAGAMENTO: { value: ContaFormaPagamento; label: string }[] = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'Pix' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'debito_automatico', label: 'Débito automático' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'outro', label: 'Outro' },
];

export const STATUS_VIEW: { value: ContaStatusView | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'vencendo_hoje', label: 'Vencendo hoje' },
  { value: 'atrasada', label: 'Atrasada' },
  { value: 'paga', label: 'Paga' },
  { value: 'cancelada', label: 'Cancelada' },
];

export const MESES = [
  { value: '0', label: 'Jan' },
  { value: '1', label: 'Fev' },
  { value: '2', label: 'Mar' },
  { value: '3', label: 'Abr' },
  { value: '4', label: 'Mai' },
  { value: '5', label: 'Jun' },
  { value: '6', label: 'Jul' },
  { value: '7', label: 'Ago' },
  { value: '8', label: 'Set' },
  { value: '9', label: 'Out' },
  { value: '10', label: 'Nov' },
  { value: '11', label: 'Dez' },
];

export function formatCurrency(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateBR(dateOnly: string | null | undefined): string {
  if (!dateOnly) return '—';
  const [y, m, d] = dateOnly.slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function labelFormaPagamento(value: string | null | undefined): string {
  return FORMAS_PAGAMENTO.find((f) => f.value === value)?.label || (value || '—');
}

export function labelPrioridade(value: string | null | undefined): string {
  return PRIORIDADES.find((p) => p.value === value)?.label || (value || '—');
}

export function labelStatus(value: ContaStatusView): string {
  return STATUS_VIEW.find((s) => s.value === value)?.label || value;
}

/** Status calculado automaticamente a partir da data e do status base. */
export function computeStatus(conta: ContaPagar, todayISO: string): ContaStatusView {
  if (conta.status === 'paga') return 'paga';
  if (conta.status === 'cancelada') return 'cancelada';
  const venc = conta.data_vencimento.slice(0, 10);
  if (venc === todayISO) return 'vencendo_hoje';
  if (venc < todayISO) return 'atrasada';
  return 'pendente';
}

export function statusBadgeClass(status: ContaStatusView): string {
  switch (status) {
    case 'paga':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'atrasada':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'vencendo_hoje':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'cancelada':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-blue-100 text-blue-700 border-blue-200';
  }
}

export function prioridadeBadgeClass(prioridade: string): string {
  switch (prioridade) {
    case 'urgente':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'importante':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'baixa':
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
