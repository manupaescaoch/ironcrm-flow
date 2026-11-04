import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { FuTaskItem } from './fuTaskState';
import type { CommercialIdentity, CommercialConfirmation } from './confirmCommercialFollowUp';

export type InternalConfirmation = { ok: true; duplicado: boolean; confirmado_em: string; responsavel: string; task_id: string; lead_id: string; matricula_id: string; unidade_id: string; etapa: string };
export type ConfirmationTransport = (name: string, body: Record<string, unknown>) => Promise<unknown>;
export const confirmationDevelopmentEnabled = import.meta.env.DEV && import.meta.env.VITE_FU_CRM_CONFIRMATION_ENABLED === 'true';

export const invokeConfirmation: ConfirmationTransport = async (name, body) => {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    throw new Error(details || 'Não foi possível verificar a confirmação. Consulte o estado antes de tentar novamente.');
  }
  return data;
};

export function createInternalConfirmation(transport: ConfirmationTransport) {
  const pending = new Map<string, Promise<InternalConfirmation>>();
  return (item: FuTaskItem): Promise<InternalConfirmation> => {
    const body = { task_id: item.id, lead_id: item.leadId, matricula_id: item.enrollmentId, unidade_id: item.unitId, etapa: item.stage };
    const key = JSON.stringify(body);
    const existing = pending.get(key);
    if (existing) return existing;
    const run = (async () => {
      const result = await transport('fu-crm-confirmar-envio', body) as Partial<InternalConfirmation> | null;
      if (!result?.ok || !result.confirmado_em || !result.responsavel || result.task_id !== item.id || result.lead_id !== item.leadId || result.matricula_id !== item.enrollmentId || result.unidade_id !== item.unitId || result.etapa !== item.stage) throw new Error('Não foi possível verificar a confirmação deste aluno na unidade atual.');
      return result as InternalConfirmation;
    })();
    pending.set(key, run);
    void run.finally(() => { if (pending.get(key) === run) pending.delete(key); }).catch(() => {});
    return run;
  };
}

export async function confirmCommercialTransaction(identity: CommercialIdentity, transport = invokeConfirmation): Promise<CommercialConfirmation> {
  const result = await transport('fu-comercial-confirmar', { follow_up_id: identity.id, lead_id: identity.leadId, unidade_id: identity.unitId, etapa: identity.stage }) as CommercialConfirmation | null;
  if (!result?.row || result.row.id !== identity.id || result.row.lead_id !== identity.leadId || result.row.unidade_id !== identity.unitId || result.row.tipo !== identity.stage || result.row.status !== 'concluido' || !result.row.concluido_em || typeof result.historyPending !== 'boolean' || typeof result.alreadyConfirmed !== 'boolean') throw new Error('Não foi possível verificar a confirmação comercial. Consulte o estado antes de tentar novamente.');
  return result;
}