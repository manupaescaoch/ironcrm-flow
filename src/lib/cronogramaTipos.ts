// Client-side helpers para agrupar cronograma_atividades por tipo.
export const TIPO_LABELS: Record<string, string> = {
  'ENVIO DA GRADE DE HORARIO PARA COORDENADOR': 'Envio da grade de horário para coordenador',
  'ENCERRAMENTO DE TURNO': 'Encerramento de turno',
  'ABERTURA DE TURNO': 'Abertura de turno',
  'RELATORIO DIARIO': 'Relatório diário',
  'CONFERENCIA DE AGENDA': 'Conferência de agenda',
  'ANAMNESE': 'Anamnese',
  'ENCERRAMENTO COORDENADOR': 'Encerramento coordenador',
};

export function labelTipo(t: string | null | undefined) {
  if (!t) return 'Sem tipo';
  return TIPO_LABELS[t] ?? t.charAt(0) + t.slice(1).toLowerCase();
}

// Normalizador client-side (fallback para itens sem tipo)
export function normalizeTipo(titulo: string | null | undefined): string {
  if (!titulo) return 'SEM TIPO';
  let t = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  t = t.replace(/\s*[-–—]\s*(UNIDADE|TURNO|RESPONSAVEL)\b.*$/g, '');
  t = t.replace(/\s*\(.*\)\s*$/, '');
  t = t.replace(/\s*\d{1,2}[:h]\d{0,2}\s*/g, ' ');
  t = t.replace(/\s*TURNO\s*\d+\s*$/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (/ENVIO.*GRADE.*HORARIO.*COORDENADOR/.test(t)) return 'ENVIO DA GRADE DE HORARIO PARA COORDENADOR';
  if (/ENCERRAMENTO.*TURNO/.test(t)) return 'ENCERRAMENTO DE TURNO';
  if (/ABERTURA.*TURNO/.test(t)) return 'ABERTURA DE TURNO';
  if (/RELATORIO.*DIARIO/.test(t)) return 'RELATORIO DIARIO';
  if (/CONFERENCIA.*AGENDA/.test(t)) return 'CONFERENCIA DE AGENDA';
  if (/ANAMNESE/.test(t)) return 'ANAMNESE';
  if (/ENCERRAMENTO.*COORDENADOR/.test(t)) return 'ENCERRAMENTO COORDENADOR';
  return t;
}

export const DIAS_LABEL_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
