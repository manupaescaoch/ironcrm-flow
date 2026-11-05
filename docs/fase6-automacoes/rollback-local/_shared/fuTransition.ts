export type TransitionFamily = 'R01' | 'R02' | 'G02';
export interface TransitionCandidate {
  familia: TransitionFamily;
  etapa: string;
  lead_id: string;
  unidade_id: string;
  ciclo_id?: string | null;
  referencia?: string | null;
  legado_id?: string | null;
}
export interface TransitionDecision {
  modo: 'LEGADO' | 'OBSERVACAO' | 'NOVO';
  suprimir: boolean;
  motivo: string;
  ciclo_id?: string;
  substitutos?: string[];
}

/** Server resolves identity, approval, homologation and replacement readiness.
 * No client flags, task completion, provider sends or history migration here. */
export async function evaluateTransition(admin: any, candidate: TransitionCandidate, record = true): Promise<TransitionDecision> {
  const { data, error } = await admin.rpc('fu_transicao_avaliar', { p_candidato: candidate, p_registrar: record });
  if (error || !data || typeof data.suprimir !== 'boolean') {
    throw new Error('Transição indisponível; nenhuma supressão autorizada');
  }
  return data;
}