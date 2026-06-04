import { Lead, Interacao } from '@/types/database';
import { EventoItem } from '@/components/dashboard/EventosHoje';
import { formatDateOnly } from '@/lib/brasilia';

/**
 * Map raw Supabase data to Lead type
 */
export function mapToLead(data: any): Lead {
  return {
    id: data.id,
    nome: data.nome,
    telefone: data.telefone,
    email: data.email || null,
    origem: data.origem || null,
    status_funil: data.status_funil,
    plano_escolhido: data.plano_escolhido || null,
    cadastrado_por: data.cadastrado_por || null,
    atendido_por: data.atendido_por || null,
    observacoes: data.observacoes || null,
    data_aula_experimental: data.data_aula_experimental || null,
    hora_aula_experimental: data.hora_aula_experimental || null,
    created_by: data.created_by || null,
    user_id: data.user_id || null,
    ativo: data.ativo ?? true,
    created_at: data.created_at || '',
    updated_at: data.updated_at || '',
    follow_up_whatsapp_enviado: data.follow_up_whatsapp_enviado || false,
    follow_up_enviado_em: data.follow_up_enviado_em || null,
    follow_up_responsavel: data.follow_up_responsavel || null,
    motivo_perda: data.motivo_perda || null,
    data_perda: data.data_perda || null,
    is_matriculado: data.is_matriculado || false,
  };
}

/**
 * Map raw Supabase data to Interacao type
 */
export function mapToInteracao(data: any): Interacao {
  return {
    id: data.id,
    lead_id: data.lead_id,
    tipo: data.tipo || '',
    descricao: data.descricao || null,
    data_interacao: data.data_interacao || '',
    created_at: data.created_at || '',
    created_by: data.created_by || null,
    atendido_por: data.atendido_por || null,
    atendido_por_tipo: data.atendido_por_tipo || null,
    agendou_experimental: data.agendou_experimental || false,
    data_experimental: data.data_experimental || null,
    hora_experimental: data.hora_experimental || null,
    compareceu: data.compareceu ?? null,
    confirmado: data.confirmado ?? null,
    reagendou: data.reagendou || false,
    fechou_matricula: data.fechou_matricula || false,
    plano_escolhido: data.plano_escolhido || null,
    valor_plano: data.valor_plano ?? null,
    comissao_comercial: data.comissao_comercial ?? null,
    comissao_recepcao: data.comissao_recepcao ?? null,
    comissao_cadastrador: data.comissao_cadastrador ?? null,
    cadastrado_por: data.cadastrado_por || null,
    data_fechamento: data.data_fechamento || null,
    responsavel_fechamento: data.responsavel_fechamento || null,
    treinador_responsavel: data.treinador_responsavel || null,
    treinador_experimental: data.treinador_experimental || null,
    origem_fechamento: data.origem_fechamento || null,
    quem_agendou: data.quem_agendou || null,
    tipo_atendimento: data.tipo_atendimento || null,
    data_avaliacao: data.data_avaliacao || null,
    hora_avaliacao: data.hora_avaliacao || null,
    status_avaliacao: data.status_avaliacao || null,
    agendado_evo: data.agendado_evo ?? false,
  };
}

/**
 * Map raw Supabase data to EventoItem
 */
export function mapToEventoItem(
  data: any,
  tipoEvento: 'experimental' | 'avaliacao'
): EventoItem | null {
  if (!data.leads || data.leads.ativo === false) return null;
  
  const lead = mapToLead(data.leads);
  const interacao = mapToInteracao(data);
  
  return { lead, interacao, tipoEvento };
}

/**
 * Format date string to Brazilian format
 */
export function formatDate(dateStr: string | null): string {
  return formatDateOnly(dateStr);
}

/**
 * Format number to Brazilian currency
 */
export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Sort EventoItem by time
 */
export function sortEventosByTime(a: EventoItem, b: EventoItem): number {
  const horaA = a.tipoEvento === 'avaliacao' ? a.interacao.hora_avaliacao : a.interacao.hora_experimental;
  const horaB = b.tipoEvento === 'avaliacao' ? b.interacao.hora_avaliacao : b.interacao.hora_experimental;
  return (horaA || '').localeCompare(horaB || '');
}
