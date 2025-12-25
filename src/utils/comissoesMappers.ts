import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Normaliza nome de cadastrador
 */
export function normalizeCadastrador(nome: string | null | undefined): string {
  if (!nome) return 'NÃO INFORMADO';
  const normalizado = nome.trim().toUpperCase();
  
  const mapeamento: Record<string, string> = {
    'ANDREZA': 'ANDREZA TEODORO',
    'THAIS': 'THAIS',
    'THAÍS': 'THAIS',
    'GABRIELA': 'GABRIELA LIMA',
    'NATANAEL': 'NATANAEL DA SILVA',
    'GABRIEL': 'GABRIEL',
    'MANU PAES': 'ANDREZA TEODORO',
    'MANU': 'ANDREZA TEODORO',
  };
  
  if (mapeamento[normalizado]) {
    return mapeamento[normalizado];
  }
  
  for (const [key, value] of Object.entries(mapeamento)) {
    if (normalizado.includes(key)) {
      return value;
    }
  }
  
  return normalizado;
}

/**
 * Verifica se deve excluir responsável
 */
export function deveExcluirResponsavel(nome: string | null | undefined): boolean {
  if (!nome) return false;
  const normalizado = nome.trim().toLowerCase();
  return normalizado === 'manu paes' || 
         normalizado === 'emanuel.paes@gmail.com' ||
         normalizado.includes('manu paes');
}

/**
 * Valida se é um treinador válido
 */
export function isValidTreinador(nome: string | null | undefined): boolean {
  if (!nome || nome.trim() === '') return false;
  
  const normalizado = nome.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const invalidPatterns = [
    /sem experimental/i,
    /indicacao/i,
    /indicação/i,
    /recepcao/i,
    /recepção/i,
    /transferencia/i,
    /transferência/i,
    /zona sul/i,
    /zona norte/i,
    /veio da/i,
    /aluno veio/i,
    /unidade/i,
    /processo/i,
    /justificativa/i,
    /observacao/i,
    /observação/i,
    /n\/a/i,
    /nao informado/i,
    /não informado/i,
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(normalizado)) return false;
  }
  
  const palavras = nome.trim().split(/\s+/);
  if (palavras.length > 5) return false;
  
  return true;
}

/**
 * Padroniza nome de treinador
 */
export function padronizarTreinadorComissoes(nome: string): string {
  const normalizado = nome.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (/^josadaque/.test(normalizado)) return 'JOSADAQUE JOSE DA SILVA';
  if (/^lucia/.test(normalizado) || /^lúcia/.test(normalizado)) return 'LUCIA HELENA PINTO LOPES';
  if (/^stela/.test(normalizado)) return 'STELA';
  if (/^thais/.test(normalizado) || /^thaís/.test(normalizado)) return 'THAIS';
  if (/^gabriela/.test(normalizado)) return 'GABRIELA LIMA';
  if (/^natanael/.test(normalizado)) return 'NATANAEL DA SILVA';
  if (/^andreza/.test(normalizado)) return 'ANDREZA TEODORO';
  if (/^gabriel$/.test(normalizado)) return 'GABRIEL';
  if (/^sistema/.test(normalizado)) return 'SISTEMA';
  if (/^(nao informado|n[aã]o informado|desconhecido|vazio|null|undefined|-|n\/a)/.test(normalizado)) {
    return 'NAO INFORMADO';
  }
  
  return nome.trim().toUpperCase();
}

/**
 * Calcula bônus por aluno
 */
export function calcularBonusPorAluno(matriculas: number): number {
  if (matriculas === 0) return 0;
  if (matriculas >= 1 && matriculas <= 4) return 20;
  if (matriculas >= 5 && matriculas <= 7) return 25;
  if (matriculas >= 8 && matriculas <= 10) return 30;
  if (matriculas >= 11) return 40;
  return 0;
}

/**
 * Formata valor monetário
 */
export function formatComissaoCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata data
 */
export function formatComissaoDate(dateString: string | null): string {
  if (!dateString) return '-';
  return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
}
