import { supabase } from '@/integrations/supabase/client';
import { confirmCommercialFollowUp, type CommercialIdentity, type CommercialStore, type PersistedCommercial } from './confirmCommercialFollowUp';

const columns = 'id,lead_id,unidade_id,tipo,status,concluido_em';
const query = (identity: CommercialIdentity) => supabase.from('follow_ups').select(columns).eq('id', identity.id).eq('lead_id', identity.leadId).eq('unidade_id', identity.unitId).eq('tipo', identity.stage);
const store: CommercialStore = {
  read: async identity => { const result = await query(identity).maybeSingle(); return { ...result, data: result.data as PersistedCommercial | null }; },
  completePending: async (identity, at, responsible) => {
    const result = await supabase.from('follow_ups').update({ status: 'concluido', concluido_em: at, concluido_por: responsible }).eq('id', identity.id).eq('lead_id', identity.leadId).eq('unidade_id', identity.unitId).eq('tipo', identity.stage).eq('status', 'pendente').select(columns).maybeSingle();
    return { ...result, data: result.data as PersistedCommercial | null };
  },
  addHistory: async (identity, row, responsible, description) => {
    // Stable primary key lets a lost history response be read back without another insert.
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`fu-confirmation:${identity.id}:${row.concluido_em}`)));
    bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes.slice(0, 16), value => value.toString(16).padStart(2, '0')).join('');
    const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    let result;
    try {
      result = await supabase.from('interacoes').insert({ id, lead_id: identity.leadId, unidade_id: identity.unitId, tipo: 'Follow Up', descricao: description, data_interacao: row.concluido_em ?? new Date().toISOString(), atendido_por: responsible }).select('id').maybeSingle();
    } catch { result = { data: null, error: true }; }
    if (result.error || !result.data) return await supabase.from('interacoes').select('id').eq('id', id).eq('lead_id', identity.leadId).eq('unidade_id', identity.unitId).maybeSingle();
    return result;
  },
};
export const confirmCommercial = (identity: CommercialIdentity, responsible: string, description: string) => confirmCommercialFollowUp(store, identity, responsible, description);