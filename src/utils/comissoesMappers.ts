import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Normaliza nome de cadastrador
 */
export function normalizeCadastrador(nome: string | null | undefined): string {
  if (!nome) return 'NAO INFORMADO';
  
  // Remove acentos e converte para maiúsculas
  const normalizado = nome.trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Mapeamento por prefixo (ordem importa - mais específico primeiro)
  if (normalizado.startsWith('MANU')) return 'ANDREZA TEODORO';
  if (normalizado.startsWith('ANDREZA')) return 'ANDREZA TEODORO';
  if (normalizado.startsWith('THAIS')) return 'THAIS';
  if (normalizado.startsWith('GABRIELA')) return 'GABRIELA LIMA';
  if (normalizado.startsWith('NATAN')) return 'NATANAEL DA SILVA';
  if (normalizado === 'GABRIEL') return 'GABRIEL';
  
  // Retorna normalizado (sem acentos, maiúsculas)
  return normalizado || 'NAO INFORMADO';
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
  
  // Excluir MANU
  if (/^manu/.test(normalizado)) return '';
  
  // Valores inválidos
  if (/^0+$/.test(normalizado) || normalizado === '') return '';
  
  // Treinadores conhecidos (ordem importa - mais específico primeiro)
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
  
  // Consolidar Giovanna
  if (/^giovan[na]/.test(normalizado)) return 'GIOVANNA KELLY DA SILVA';
  if (/^luan/.test(normalizado)) return 'LUAN MONTEIRO TEIXEIRA';
  // Consolidar Ana / Bia / Ana Beatriz
  if (/^(ana|bia)/.test(normalizado)) return 'ANA BEATRIZ';
  if (/^andre/.test(normalizado)) return 'ANDRE MOREIRA';
  if (/^charles/.test(normalizado)) return 'CHARLES';
  if (/^eduarda/.test(normalizado)) return 'EDUARDA';
  if (/^eduardo/.test(normalizado)) return 'EDUARDO';
  if (/^davi/.test(normalizado)) return 'DAVI';
  // Consolidar Rian / Ryan
  if (/^r[iy]an/.test(normalizado)) return 'RYAN';
  
  if (/^sistema/.test(normalizado)) return 'SISTEMA';
  if (/^(nao informado|desconhecido|vazio|null|undefined|-|n\/a)/.test(normalizado)) {
    return 'NAO INFORMADO';
  }
  
  return nome.trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
