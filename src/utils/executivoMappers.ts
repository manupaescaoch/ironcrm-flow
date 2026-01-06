import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Padroniza origem de leads
 */
export function padronizarOrigem(origem: string | null | undefined): string {
  if (!origem || origem.trim() === '') return 'NÃO INFORMADO';
  
  const normalizado = origem.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (/^(whats|whasapp|whatspp|whatsapp|wpp|zap|zapzap)/.test(normalizado)) {
    return 'WHATSAPP';
  }
  
  if (/^(insta|instagram|instagran|ig)/.test(normalizado)) {
    return 'INSTAGRAM';
  }
  
  if (/^(trafego|ads|anuncio|anuncios|google ads|meta ads|facebook ads|campanha|patrocinado)/.test(normalizado) ||
      normalizado.includes('pago') || normalizado.includes('ads')) {
    return 'TRÁFEGO PAGO';
  }
  
  if (/^(indica|idicacao|indicacao|indicacoes)/.test(normalizado) ||
      normalizado.includes('indica')) {
    return 'INDICAÇÃO';
  }
  
  if (/^(presencial|visita|pessoalmente|diretamente|unidade|na academia|passou na frente|passando)/.test(normalizado) ||
      normalizado.includes('presencial') || normalizado.includes('visita')) {
    return 'VISITA PRESENCIAL';
  }
  
  if (/^(terceiro|parceiro|empresa|convenio|corporativo|b2b)/.test(normalizado) ||
      normalizado.includes('terceiro') || normalizado.includes('parceiro')) {
    return 'TERCEIROS';
  }
  
  if (/^(nao informado|n[aã]o informado|desconhecido|sem informacao|vazio|null|undefined|-|n\/a)/.test(normalizado)) {
    return 'NÃO INFORMADO';
  }
  
  return origem.trim().toUpperCase();
}

/**
 * Verifica se deve excluir responsável
 */
export function deveExcluirResponsavel(nome: string | null | undefined): boolean {
  if (!nome) return false;
  const normalizado = nome.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalizado === 'manu paes' || 
         normalizado === 'manu' ||
         normalizado === 'emanuel.paes@gmail.com' ||
         normalizado.includes('manu paes') ||
         normalizado.includes('manu ') ||
         /^manu/.test(normalizado);
}

/**
 * Padroniza nome de responsável
 */
export function padronizarResponsavel(nome: string | null | undefined): string {
  if (!nome || nome.trim() === '') return 'NAO INFORMADO';
  
  const normalizado = nome.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (/^thais/.test(normalizado)) return 'THAIS';
  if (/^gabriela/.test(normalizado)) return 'GABRIELA LIMA';
  if (/^natanael/.test(normalizado)) return 'NATANAEL DA SILVA';
  if (/^andreza/.test(normalizado)) return 'ANDREZA TEODORO';
  if (/^gabriel$/.test(normalizado) || normalizado === 'gabriel') return 'GABRIEL';
  if (/^sistema/.test(normalizado)) return 'SISTEMA';
  if (/^(nao informado|n[aã]o informado|desconhecido|vazio|null|undefined|-|n\/a)/.test(normalizado) ||
      normalizado === '') {
    return 'NAO INFORMADO';
  }
  
  return nome.trim().toUpperCase();
}

/**
 * Padroniza nome de treinador
 */
export function padronizarTreinador(nome: string | null | undefined): string {
  if (!nome || nome.trim() === '') return 'NAO INFORMADO';
  
  const normalizado = nome.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Treinadores conhecidos
  if (/^josadaque/.test(normalizado)) return 'JOSADAQUE JOSE DA SILVA';
  // Consolidar Lúcia Helena / Helena Leite
  if (/^(lucia|helena)/.test(normalizado)) return 'LUCIA HELENA PINTO LOPES';
  // Consolidar Estela / Stela
  if (/^e?stela/.test(normalizado)) return 'STELA';
  if (/^thais/.test(normalizado)) return 'THAIS';
  if (/^gabriela/.test(normalizado)) return 'GABRIELA LIMA';
  if (/^natanael/.test(normalizado)) return 'NATANAEL DA SILVA';
  if (/^andreza/.test(normalizado)) return 'ANDREZA TEODORO';
  // Consolidar Gabriel / Gabriel Araújo
  if (/^gabriel/.test(normalizado)) return 'GABRIEL ARAUJO';
  if (/^giovanna/.test(normalizado)) return 'GIOVANNA KELLY DA SILVA';
  if (/^luan/.test(normalizado)) return 'LUAN MONTEIRO TEIXEIRA';
  if (/^ana\s*beatriz/.test(normalizado)) return 'ANA BEATRIZ';
  if (/^andre\s*moreira/.test(normalizado)) return 'ANDRE MOREIRA';
  if (/^charles/.test(normalizado)) return 'CHARLES';
  if (/^eduarda/.test(normalizado)) return 'EDUARDA';
  if (/^r[iy]an/.test(normalizado)) return 'RYAN';
  if (/^sistema/.test(normalizado)) return 'SISTEMA';
  if (/^(nao informado|n[aã]o informado|desconhecido|vazio|null|undefined|-|n\/a)/.test(normalizado)) {
    return 'NAO INFORMADO';
  }
  
  return nome.trim().toUpperCase();
}

/**
 * Calcula bônus por aluno baseado nas matrículas
 */
export function calcularBonusPorAluno(matriculas: number): number {
  if (matriculas >= 11) return 40;
  if (matriculas >= 8) return 30;
  if (matriculas >= 5) return 25;
  if (matriculas >= 1) return 20;
  return 0;
}

/**
 * Formata data para exibição
 */
export function formatExecutivoDate(dateString: string): string {
  try {
    return format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateString;
  }
}

/**
 * Formata valor monetário
 */
export function formatExecutivoCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
