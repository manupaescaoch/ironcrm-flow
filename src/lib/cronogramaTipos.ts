// Client-side helpers para agrupar cronograma_atividades por tipo.

// Códigos de exibição — 4 grupos principais + OUTROS
export type TipoDisplay =
  | 'ENCERRAMENTO_COORD_UNIDADE'
  | 'RELATORIO_DIARIO_COMERCIAL'
  | 'ENCERRAMENTO_TURNO_COORD_HORARIO'
  | 'ENCERRAMENTO_ESTAGIARIO_LIDER'
  | 'ENCERRAMENTO_GERENTE_UNIDADE'
  | 'OUTROS';

export const TIPO_DISPLAY_ORDER: TipoDisplay[] = [
  'ENCERRAMENTO_COORD_UNIDADE',
  'RELATORIO_DIARIO_COMERCIAL',
  'ENCERRAMENTO_TURNO_COORD_HORARIO',
  'ENCERRAMENTO_ESTAGIARIO_LIDER',
  'ENCERRAMENTO_GERENTE_UNIDADE',
  'OUTROS',
];

export const TIPO_DISPLAY_LABEL: Record<TipoDisplay, string> = {
  ENCERRAMENTO_COORD_UNIDADE: 'Encerramento coordenador de turno',
  RELATORIO_DIARIO_COMERCIAL: 'Relatório Diário Comercial',
  ENCERRAMENTO_TURNO_COORD_HORARIO: 'Grade do próximo horário',
  ENCERRAMENTO_ESTAGIARIO_LIDER: 'Encerramento Estagiário Líder',
  ENCERRAMENTO_GERENTE_UNIDADE: 'Encerramento de Gerente de Unidade',
  OUTROS: 'Outros',
};

function stripAccents(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Classifica cada atividade em um dos 4 grupos principais (ou OUTROS)
export function classifyDisplay(a: { tipo_atividade?: string | null; titulo?: string | null }): TipoDisplay {
  const tipo = stripAccents((a.tipo_atividade || '').toUpperCase().trim());
  const titulo = stripAccents((a.titulo || '').toUpperCase().trim());
  if (tipo === 'ENCERRAMENTO ESTAGIARIO LIDER' || /ESTAGIARIO\s+LIDER/.test(titulo)) {
    return 'ENCERRAMENTO_ESTAGIARIO_LIDER';
  }
  if (tipo === 'ENCERRAMENTO GERENTE UNIDADE' || /GERENTE\s+(DE\s+)?UNIDADE/.test(titulo)) {
    return 'ENCERRAMENTO_GERENTE_UNIDADE';
  }
  if (tipo === 'RELATORIO DIARIO' || /RELATORIO\s+DIARIO/.test(titulo)) {
    return 'RELATORIO_DIARIO_COMERCIAL';
  }
  if (tipo === 'ENVIO DA GRADE DE HORARIO PARA COORDENADOR' || /ENVIO.*GRADE.*HORARIO/.test(titulo)) {
    return 'ENCERRAMENTO_TURNO_COORD_HORARIO';
  }
  if (tipo === 'ENCERRAMENTO DE TURNO' || /ENCERRAMENTO.*(COORDENADOR|TURNO)/.test(titulo)) {
    return 'ENCERRAMENTO_COORD_UNIDADE';
  }
  return 'OUTROS';
}

// Compat: mantido para código legado (BulkEditDialog etc.)
export const TIPO_LABELS: Record<string, string> = {
  'ENVIO DA GRADE DE HORARIO PARA COORDENADOR': 'Envio da grade de horário para coordenador',
  'ENCERRAMENTO DE TURNO': 'Encerramento de turno',
  'ABERTURA DE TURNO': 'Abertura de turno',
  'RELATORIO DIARIO': 'Relatório diário',
  'CONFERENCIA DE AGENDA': 'Conferência de agenda',
  'ANAMNESE': 'Anamnese',
  'ENCERRAMENTO COORDENADOR': 'Encerramento coordenador',
  'ENCERRAMENTO ESTAGIARIO LIDER': 'Encerramento estagiário líder',
};

export function labelTipo(t: string | null | undefined) {
  if (!t) return 'Sem tipo';
  return TIPO_LABELS[t] ?? t.charAt(0) + t.slice(1).toLowerCase();
}

export function normalizeTipo(titulo: string | null | undefined): string {
  if (!titulo) return 'SEM TIPO';
  let t = stripAccents(titulo).toUpperCase().trim();
  t = t.replace(/\s*[-–—]\s*(UNIDADE|TURNO|RESPONSAVEL)\b.*$/g, '');
  t = t.replace(/\s*\(.*\)\s*$/, '');
  t = t.replace(/\s*\d{1,2}[:h]\d{0,2}\s*/g, ' ');
  t = t.replace(/\s*TURNO\s*\d+\s*$/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (/ENVIO.*GRADE.*HORARIO.*COORDENADOR/.test(t)) return 'ENVIO DA GRADE DE HORARIO PARA COORDENADOR';
  if (/ESTAGIARIO\s+LIDER/.test(t)) return 'ENCERRAMENTO ESTAGIARIO LIDER';
  if (/ENCERRAMENTO.*TURNO/.test(t)) return 'ENCERRAMENTO DE TURNO';
  if (/ABERTURA.*TURNO/.test(t)) return 'ABERTURA DE TURNO';
  if (/RELATORIO.*DIARIO/.test(t)) return 'RELATORIO DIARIO';
  if (/CONFERENCIA.*AGENDA/.test(t)) return 'CONFERENCIA DE AGENDA';
  if (/ANAMNESE/.test(t)) return 'ANAMNESE';
  if (/ENCERRAMENTO.*COORDENADOR/.test(t)) return 'ENCERRAMENTO COORDENADOR';
  return t;
}

export const DIAS_LABEL_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
