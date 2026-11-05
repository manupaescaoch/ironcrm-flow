export type CommercialIdentity = { id: string; leadId: string; unitId: string; stage: string };
export type PersistedCommercial = { id: string; lead_id: string; unidade_id: string; tipo: string; status: string; concluido_em: string | null };
type Result<T> = { data: T | null; error?: unknown };
export interface CommercialStore {
  read: (identity: CommercialIdentity) => Promise<Result<PersistedCommercial>>;
  readHistory: (identity: CommercialIdentity, row: PersistedCommercial) => Promise<Result<{ id: string }>>;
  completePending: (identity: CommercialIdentity, at: string, responsible: string) => Promise<Result<PersistedCommercial>>;
  addHistory: (identity: CommercialIdentity, row: PersistedCommercial, responsible: string, description: string) => Promise<Result<{ id: string }>>;
}
export type CommercialConfirmation = { row: PersistedCommercial; alreadyConfirmed: boolean; historyPending: boolean };
const pending = new Map<string, Promise<CommercialConfirmation>>();
export const commercialIdentityMatches = (identity: CommercialIdentity, row: PersistedCommercial | null) =>
  !!row && row.id === identity.id && row.lead_id === identity.leadId && row.unidade_id === identity.unitId && row.tipo === identity.stage;

export function confirmCommercialFollowUp(store: CommercialStore, identity: CommercialIdentity, responsible: string, description: string): Promise<CommercialConfirmation> {
  if (!identity.id || !identity.leadId || !identity.unitId || !identity.stage) return Promise.reject(new Error('Selecione novamente este follow-up.'));
  const key = JSON.stringify(identity);
  const existing = pending.get(key);
  if (existing) return existing;
  const run = (async () => {
    const before = await store.read(identity);
    if (before.error || !commercialIdentityMatches(identity, before.data) || !before.data) throw new Error('Não foi possível verificar este follow-up na unidade atual.');
    const existingConfirmation = async (row: PersistedCommercial): Promise<CommercialConfirmation> => {
      try {
        const history = await store.readHistory(identity, row);
        return { row, alreadyConfirmed: true, historyPending: !!history.error || !history.data };
      } catch {
        return { row, alreadyConfirmed: true, historyPending: true };
      }
    };
    if (before.data.status === 'concluido' && before.data.concluido_em) return existingConfirmation(before.data);
    if (before.data.status !== 'pendente') throw new Error('Este follow-up não está mais pendente.');
    const at = new Date().toISOString();
    let updated: Result<PersistedCommercial>;
    try { updated = await store.completePending(identity, at, responsible); }
    catch { updated = { data: null, error: true }; }
    const persisted = await store.read(identity);
    if (persisted.error || !persisted.data || !commercialIdentityMatches(identity, persisted.data) || persisted.data.status !== 'concluido' || !persisted.data.concluido_em) {
      throw new Error('Não foi possível confirmar a gravação. Consulte o estado antes de tentar novamente.');
    }
    const ownsUpdate = commercialIdentityMatches(identity, updated.data) || (!!updated.error && Date.parse(persisted.data.concluido_em) === Date.parse(at));
    // Another client won the conditional update: never insert a second history.
    if (!ownsUpdate) return existingConfirmation(persisted.data);
    let historyPending = false;
    try {
      const history = await store.addHistory(identity, persisted.data, responsible, description);
      historyPending = !!history.error || !history.data;
    } catch { historyPending = true; }
    return { row: persisted.data, alreadyConfirmed: false, historyPending };
  })();
  pending.set(key, run);
  void run.finally(() => { if (pending.get(key) === run) pending.delete(key); }).catch(() => {});
  return run;
}