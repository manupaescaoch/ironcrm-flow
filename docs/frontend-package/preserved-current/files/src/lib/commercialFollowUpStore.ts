import { supabase } from '@/integrations/supabase/client';
import { confirmCommercialFollowUp, type CommercialIdentity, type CommercialStore, type PersistedCommercial } from './confirmCommercialFollowUp';
import { commercialHistoryId } from './commercialHistoryIdentity';
import { confirmationEnabledForUser, confirmCommercialTransaction } from './fuConfirmationClient';

const columns = 'id,lead_id,unidade_id,tipo,status,concluido_em';
const query = (identity: CommercialIdentity) => supabase.from('follow_ups').select(columns).eq('id', identity.id).eq('lead_id', identity.leadId).eq('unidade_id', identity.unitId).eq('tipo', identity.stage);
const store: CommercialStore = {
  read: async identity => { const result = await query(identity).maybeSingle(); return { ...result, data: result.data as PersistedCommercial | null }; },
  readHistory: async (identity, row) => {
    const id = await commercialHistoryId(identity.id, row.concluido_em ?? '');
    return supabase.from('interacoes').select('id').eq('id', id).eq('lead_id', identity.leadId).eq('unidade_id', identity.unitId).maybeSingle();
  },
  completePending: async (identity, at, responsible) => {
    const result = await supabase.from('follow_ups').update({ status: 'concluido', concluido_em: at, concluido_por: responsible }).eq('id', identity.id).eq('lead_id', identity.leadId).eq('unidade_id', identity.unitId).eq('tipo', identity.stage).eq('status', 'pendente').select(columns).maybeSingle();
    return { ...result, data: result.data as PersistedCommercial | null };
  },
  addHistory: async (identity, row, responsible, description) => {
    // Stable primary key lets a lost history response be read back without another insert.
    const id = await commercialHistoryId(identity.id, row.concluido_em ?? '');
    let result;
    try {
      result = await supabase.from('interacoes').insert({ id, lead_id: identity.leadId, unidade_id: identity.unitId, tipo: 'Follow Up', descricao: description, data_interacao: row.concluido_em ?? new Date().toISOString(), atendido_por: responsible }).select('id').maybeSingle();
    } catch { result = { data: null, error: true }; }
    if (result.error || !result.data) return await supabase.from('interacoes').select('id').eq('id', id).eq('lead_id', identity.leadId).eq('unidade_id', identity.unitId).maybeSingle();
    return result;
  },
};
export const confirmCommercial = async (identity: CommercialIdentity, responsible: string, description: string) => {
  const { data } = await supabase.auth.getSession();
  return confirmationEnabledForUser(data.session?.user.id) && identity.stage !== 'REAG' ? confirmCommercialTransaction(identity) : confirmCommercialFollowUp(store, identity, responsible, description);
};