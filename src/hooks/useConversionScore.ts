import { useMemo } from 'react';
import { Lead, Interacao } from '@/types/database';
import { differenceInDays } from 'date-fns';

export interface ConversionScoreResult {
  score: number;
  label: 'Quente' | 'Morno' | 'Frio' | 'Improvável';
  color: string;
  bgColor: string;
  fatoresPositivos: string[];
  podeMelhorar: string[];
}

const origemPesos: Record<string, number> = {
  'Visita Presencial': 25,
  'VISITA PRESENCIAL': 25,
  'WHATSAPP': 20,
  'WhatsApp': 20,
  'Whatsapp': 20,
  'INDICAÇÃO': 18,
  'Indicação': 18,
  'indicação': 18,
  'INDICACAO': 18,
  'Instagram': 8,
  'INSTAGRAM': 8,
  'Tráfego Pago': 5,
  'TRÁFEGO PAGO': 5,
  'Google': 5,
  'GOOGLE': 5,
};

const etapaPesos: Record<string, number> = {
  'negociacao': 35,
  'aula_realizada': 25,
  'aula_agendada': 15,
  'follow_up': 10,
  'contato_inicial': 8,
  'novo': 5,
};

const getOrigemLabel = (origem: string | null): string => {
  if (!origem) return 'Origem não informada';
  const normalized = origem.toUpperCase();
  if (normalized.includes('VISITA') || normalized.includes('PRESENCIAL')) return 'Visita Presencial';
  if (normalized.includes('WHATSAPP')) return 'WhatsApp';
  if (normalized.includes('INDICA')) return 'Indicação';
  if (normalized.includes('INSTAGRAM')) return 'Instagram';
  return origem;
};

const getEtapaLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'negociacao': 'Negociação',
    'aula_realizada': 'Aula Realizada',
    'aula_agendada': 'Aula Agendada',
    'follow_up': 'Follow-up',
    'contato_inicial': 'Contato Inicial',
    'novo': 'Novo',
  };
  return labels[status] || status;
};

export const calcularConversionScore = (
  lead: Lead,
  interacoes: Interacao[]
): ConversionScoreResult => {
  let score = 0;
  const fatoresPositivos: string[] = [];
  const podeMelhorar: string[] = [];

  // 1. ORIGEM (0-25 pontos)
  const origemNormalizada = lead.origem?.toUpperCase() || '';
  let origemPontos = 5;
  
  for (const [key, value] of Object.entries(origemPesos)) {
    if (origemNormalizada.includes(key.toUpperCase())) {
      origemPontos = value;
      break;
    }
  }
  
  score += origemPontos;
  if (origemPontos >= 15) {
    fatoresPositivos.push(`Origem: ${getOrigemLabel(lead.origem)} (+${origemPontos})`);
  }

  // 2. ETAPA DO FUNIL (0-35 pontos)
  const etapaPontos = etapaPesos[lead.status_funil] || 0;
  score += etapaPontos;
  
  if (etapaPontos >= 15) {
    fatoresPositivos.push(`Etapa: ${getEtapaLabel(lead.status_funil)} (+${etapaPontos})`);
  }
  
  if (lead.status_funil === 'aula_realizada' || lead.status_funil === 'follow_up') {
    podeMelhorar.push('Avançar para Negociação (+10)');
  } else if (lead.status_funil === 'aula_agendada') {
    podeMelhorar.push('Realizar aula experimental (+10)');
  } else if (lead.status_funil === 'novo' || lead.status_funil === 'contato_inicial') {
    podeMelhorar.push('Agendar aula experimental (+10)');
  }

  // 3. COMPARECIMENTO EM EXPERIMENTAL (0-20 pontos)
  const compareceu = interacoes.some(i => i.compareceu === true);
  if (compareceu) {
    score += 20;
    fatoresPositivos.push('Compareceu na experimental (+20)');
  } else if (lead.data_aula_experimental) {
    podeMelhorar.push('Confirmar comparecimento (+20)');
  } else {
    podeMelhorar.push('Agendar aula experimental (+20)');
  }

  // 4. NÚMERO DE INTERAÇÕES (0-10 pontos)
  const qtdInteracoes = interacoes.length;
  let interacaoPontos = 0;
  
  if (qtdInteracoes >= 4) {
    interacaoPontos = 10;
  } else if (qtdInteracoes >= 2) {
    interacaoPontos = 7;
  } else if (qtdInteracoes >= 1) {
    interacaoPontos = 4;
  }
  
  score += interacaoPontos;
  
  if (interacaoPontos >= 7) {
    fatoresPositivos.push(`${qtdInteracoes} interações (+${interacaoPontos})`);
  } else if (qtdInteracoes < 4) {
    podeMelhorar.push(`Mais follow-ups (+${10 - interacaoPontos})`);
  }

  // 5. TEMPO DE RESPOSTA (0-10 pontos)
  const diasNoFunil = differenceInDays(new Date(), new Date(lead.created_at));
  let tempoPontos = 0;
  
  if (diasNoFunil <= 3) {
    tempoPontos = 10;
  } else if (diasNoFunil <= 7) {
    tempoPontos = 6;
  } else if (diasNoFunil <= 14) {
    tempoPontos = 3;
  }
  
  score += tempoPontos;
  
  if (tempoPontos >= 6) {
    fatoresPositivos.push(`Lead recente (${diasNoFunil} dias) (+${tempoPontos})`);
  } else if (diasNoFunil > 14) {
    podeMelhorar.push('Lead antigo - priorizar contato');
  }

  // Limitar score a 100
  score = Math.min(score, 100);

  // Classificação
  let label: ConversionScoreResult['label'];
  let color: string;
  let bgColor: string;

  if (score >= 80) {
    label = 'Quente';
    color = 'text-green-600';
    bgColor = 'bg-green-500';
  } else if (score >= 60) {
    label = 'Morno';
    color = 'text-yellow-600';
    bgColor = 'bg-yellow-500';
  } else if (score >= 40) {
    label = 'Frio';
    color = 'text-orange-600';
    bgColor = 'bg-orange-500';
  } else {
    label = 'Improvável';
    color = 'text-red-600';
    bgColor = 'bg-red-500';
  }

  return {
    score,
    label,
    color,
    bgColor,
    fatoresPositivos,
    podeMelhorar: podeMelhorar.slice(0, 3), // Limitar a 3 sugestões
  };
};

export const useConversionScore = (
  lead: Lead | null,
  interacoes: Interacao[]
): ConversionScoreResult | null => {
  return useMemo(() => {
    if (!lead) return null;
    return calcularConversionScore(lead, interacoes);
  }, [lead, interacoes]);
};
