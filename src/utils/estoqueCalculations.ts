import { addDays, differenceInDays } from 'date-fns';

// ============= TIPOS COMPARTILHADOS =============

export type StatusEstoque = 'Normal' | 'Atenção' | 'Crítico' | 'Sem Estoque';

export interface MovimentacaoBase {
  id: string;
  insumo_id: string;
  tipo: string;
  quantidade: number;
  created_at: string;
}

export interface CalculoEstoqueParams {
  quantidade_atual: number;
  retiradas: MovimentacaoBase[];
  lead_time_dias: number;
  estoque_seguranca_dias: number;
  custo_unitario?: number;
  quantidade_minima_compra?: number;
  // Campos para média manual
  media_diaria_manual?: number | null;
  usar_media_manual?: boolean;
}

export interface CalculoEstoqueResult {
  media_diaria: number;
  media_semanal: number;
  media_mensal: number;
  duracao_media_por_unidade: number | null;
  retiradas_count: number;
  dias_restantes: number | null;
  ponto_pedido: number;
  data_ruptura: Date | null;
  data_limite_pedido: Date | null;
  dias_para_pedir: number | null;
  status_estoque: StatusEstoque;
  // Financeiros
  valor_estoque_atual: number;
  valor_ponto_pedido: number;
  valor_reposicao: number;
}

// ============= FUNÇÕES DE CÁLCULO =============

/**
 * Calcula o status preditivo do estoque baseado em quantidade, ponto de pedido e datas
 */
export function calcularStatusPreditivo(
  quantidadeAtual: number,
  pontoPedido: number,
  dataLimitePedido: Date | null,
  dataRuptura: Date | null
): StatusEstoque {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // ☠️ Sem Estoque: estoque = 0 ou data atual > data de ruptura
  if (quantidadeAtual === 0) return 'Sem Estoque';
  if (dataRuptura && hoje > dataRuptura) return 'Sem Estoque';

  // 🔴 Crítico: data atual >= data limite de pedido
  if (dataLimitePedido && hoje >= dataLimitePedido) return 'Crítico';

  // 🟡 Atenção: estoque atual <= ponto de pedido
  if (quantidadeAtual <= pontoPedido) return 'Atenção';

  // 🟢 Normal: estoque atual > ponto de pedido
  return 'Normal';
}

/**
 * Calcula a duração média por unidade baseado no histórico de retiradas
 * Fórmula: (Data última retirada - Data primeira retirada) / Total unidades consumidas
 */
export function calcularDuracaoMediaPorUnidade(
  retiradas: MovimentacaoBase[],
  totalRetirado: number
): number | null {
  if (retiradas.length < 2 || totalRetirado <= 0) {
    return null;
  }

  const retiradasOrdenadas = [...retiradas].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  const primeiraRetirada = new Date(retiradasOrdenadas[0].created_at);
  const ultimaRetirada = new Date(retiradasOrdenadas[retiradasOrdenadas.length - 1].created_at);
  const periodoEmDias = Math.max(1, Math.ceil((ultimaRetirada.getTime() - primeiraRetirada.getTime()) / (1000 * 60 * 60 * 24)));
  
  return Math.round((periodoEmDias / totalRetirado) * 10) / 10;
}

/**
 * Calcula a média diária de consumo
 */
export function calcularMediaDiaria(
  duracaoMediaPorUnidade: number | null,
  totalRetirado: number,
  diasComOperacao: number
): number {
  if (duracaoMediaPorUnidade && duracaoMediaPorUnidade > 0) {
    // Inverso da duração média: se 1 unidade dura 5 dias, consumo = 0.2/dia
    return 1 / duracaoMediaPorUnidade;
  }
  return totalRetirado / Math.max(diasComOperacao, 1);
}

/**
 * Calcula os dias restantes de estoque
 * Retorna 0 se quantidade_atual = 0, null se não há dados de consumo
 */
export function calcularDiasRestantes(
  quantidadeAtual: number,
  mediaDiaria: number
): number | null {
  if (quantidadeAtual === 0) return 0;
  if (mediaDiaria > 0) return Math.floor(quantidadeAtual / mediaDiaria);
  return null;
}

/**
 * Calcula o ponto de pedido (reorder point)
 * Fórmula: (Lead Time + Estoque de Segurança) × Consumo Médio Diário
 */
export function calcularPontoPedido(
  leadTimeDias: number,
  estoqueSegurancaDias: number,
  mediaDiaria: number
): number {
  return Math.ceil((leadTimeDias + estoqueSegurancaDias) * mediaDiaria);
}

/**
 * Calcula a data de ruptura do estoque
 * Fórmula: Data Atual + Dias Restantes
 */
export function calcularDataRuptura(diasRestantes: number | null): Date | null {
  if (diasRestantes === null) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return addDays(hoje, diasRestantes);
}

/**
 * Calcula a data limite para fazer o pedido
 * Fórmula: Data de Ruptura - Lead Time
 */
export function calcularDataLimitePedido(
  dataRuptura: Date | null,
  leadTimeDias: number
): Date | null {
  if (!dataRuptura) return null;
  return addDays(dataRuptura, -leadTimeDias);
}

/**
 * Função principal que orquestra todos os cálculos de métricas de estoque
 */
export function calcularMetricasEstoque(params: CalculoEstoqueParams): CalculoEstoqueResult {
  const {
    quantidade_atual,
    retiradas,
    lead_time_dias,
    estoque_seguranca_dias,
    custo_unitario = 0,
    quantidade_minima_compra = 1,
    media_diaria_manual,
    usar_media_manual,
  } = params;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Calcular total retirado e dias com operação
  const totalRetirado = retiradas.reduce((sum, m) => sum + m.quantidade, 0);
  const diasComOperacao = new Set(retiradas.map(m => m.created_at.split('T')[0])).size || 1;
  const retiradas_count = retiradas.length;

  // Duração média por unidade
  const duracao_media_por_unidade = calcularDuracaoMediaPorUnidade(retiradas, totalRetirado);

  // Média diária: usar média manual se habilitada, caso contrário cálculo automático
  let media_diaria_raw: number;
  if (usar_media_manual && media_diaria_manual && media_diaria_manual > 0) {
    media_diaria_raw = media_diaria_manual;
  } else {
    media_diaria_raw = calcularMediaDiaria(duracao_media_por_unidade, totalRetirado, diasComOperacao);
  }
  const media_diaria = Math.round(media_diaria_raw * 10) / 10;

  // Médias semanal e mensal
  const media_semanal = Math.round(media_diaria_raw * 7 * 10) / 10;
  const media_mensal = Math.round(media_diaria_raw * 30 * 10) / 10;

  // Dias restantes
  const dias_restantes = calcularDiasRestantes(quantidade_atual, media_diaria_raw);

  // Ponto de pedido
  const ponto_pedido = calcularPontoPedido(lead_time_dias, estoque_seguranca_dias, media_diaria_raw);

  // Datas preditivas
  const data_ruptura = calcularDataRuptura(dias_restantes);
  const data_limite_pedido = calcularDataLimitePedido(data_ruptura, lead_time_dias);
  const dias_para_pedir = data_limite_pedido ? differenceInDays(data_limite_pedido, hoje) : null;

  // Status
  const status_estoque = calcularStatusPreditivo(quantidade_atual, ponto_pedido, data_limite_pedido, data_ruptura);

  // Valores financeiros
  const valor_estoque_atual = quantidade_atual * custo_unitario;
  const valor_ponto_pedido = ponto_pedido * custo_unitario;
  const valor_reposicao = quantidade_minima_compra * custo_unitario;

  return {
    media_diaria,
    media_semanal,
    media_mensal,
    duracao_media_por_unidade,
    retiradas_count,
    dias_restantes,
    ponto_pedido,
    data_ruptura,
    data_limite_pedido,
    dias_para_pedir,
    status_estoque,
    valor_estoque_atual,
    valor_ponto_pedido,
    valor_reposicao,
  };
}

// ============= FORMATADORES =============

export const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const formatNumber = (value: number): string => {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
};
