export interface ContactIntent {
  lead_id: string;
  unidade_id: string;
  chave: string;
  fluxo: string;
  objetivo: string;
  setor: string;
  canal: string;
  ciclo_id?: string | null;
  tipo_fu?: string | null;
  responsavel?: string;
  prazo_original?: string | null;
  prioridade: number;
  nao_urgente: boolean;
  excecao?: string | null;
}
export interface ContactDecision { id: string; permitido: boolean; modo: string; motivo?: string; proxima_tentativa?: string; }

export async function reserveContact(admin: any, intent: ContactIntent): Promise<ContactDecision> {
  const { data, error } = await admin.rpc('contato_reservar', { p_intencao: intent });
  if (error || !data?.id) throw new Error('Não foi possível reservar o contato com segurança');
  return data;
}
export async function finishContact(admin: any, id: string, state: 'enviado' | 'incerto' | 'pendente', result: string) {
  const { error } = await admin.rpc('contato_resultado', { p_id: id, p_estado: state, p_resultado: result });
  if (error) throw new Error('Resultado do contato pendente de reconciliação');
}

// A group reminder is only a candidate observation, never a student contact or reservation.
export async function observeManualCandidate(admin: any, intent: ContactIntent) {
  const { data, error } = await admin.rpc('contato_observar', { p_intencao: intent });
  if (error) throw new Error('Não foi possível observar o contato');
  return data as ContactDecision | null;
}

export async function controlledSend(
  admin: any, intent: ContactIntent,
  send: () => Promise<{ ok: boolean; skipped: boolean; status: number; body: any }>,
) {
  const decision = await reserveContact(admin, intent);
  if (!decision.permitido) return { ok: false, skipped: true, deferred: true, status: 0, body: { motivo: decision.motivo, proxima_tentativa: decision.proxima_tentativa } };
  try {
    const result = await send();
    // A reused provider key is NOT proof of successful delivery.
    await finishContact(admin, decision.id, result.ok && !result.skipped ? 'enviado' : 'incerto', result.skipped ? 'Chave de envio existente; reconciliar' : `HTTP ${result.status}`);
    return { ...result, deferred: false };
  } catch (error) {
    await finishContact(admin, decision.id, 'incerto', 'Tentativa sem confirmação confiável; reconciliar');
    throw error;
  }
}