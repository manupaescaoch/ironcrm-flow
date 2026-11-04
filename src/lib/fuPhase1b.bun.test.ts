import { describe, test, expect } from 'bun:test';
import { contactKey, contactMatches } from './fuContactIdentity';
import { confirmCommercialFollowUp, type CommercialStore, type PersistedCommercial } from './confirmCommercialFollowUp';
import { taskFuItem, pendingFuMessages, confirmedFuToday } from './fuTaskState';
import { telefoneTecnico } from './fuTecnico';
import type { Task } from '@/hooks/useTarefasData';
import { commercialHistoryId } from './commercialHistoryIdentity';
const identity = { id: 'a', leadId: 'alfa', unitId: 'one', stage: 'D+1' };
const original: PersistedCommercial = { id: 'a', lead_id: 'alfa', unidade_id: 'one', tipo: 'D+1', status: 'pendente', concluido_em: null };
function fixture(mode: 'ok' | 'zero' | 'history-failure' | 'lost-response' = 'ok') {
  let row = { ...original }; let historyCount = 0; let updateCount = 0;
  const store: CommercialStore = {
    read: async () => ({ data: { ...row } }),
    completePending: async (_identity, at) => { updateCount++; if (mode === 'zero') return { data: null }; row = { ...row, status: 'concluido', concluido_em: at }; if (mode === 'lost-response') throw new Error('response lost'); return { data: row }; },
    addHistory: async () => { historyCount++; return mode === 'history-failure' ? { data: null, error: true } : { data: { id: 'history' } }; },
  };
  return { store, counts: () => ({ historyCount, updateCount }), row: () => row };
}
describe('Fase 1B identity and persistence', () => {
  test('A to B to C never accepts a prior loaded identity', () => {
    const base = { taskId: 'A', leadId: 'ALFA', enrollmentId: 'EA', unitId: 'ONE', stage: 'M+15' };
    const a = contactKey(base); const b = contactKey({ ...base, taskId: 'B', leadId: 'BETA', enrollmentId: 'EB' }); const c = contactKey({ ...base, taskId: 'C', leadId: 'GAMA', enrollmentId: 'EC' });
    expect(contactMatches(b, a)).toBe(false); expect(contactMatches(c, b)).toBe(false); expect(contactMatches(c, c)).toBe(true);
    expect(contactMatches(contactKey({ ...base, unitId: 'TWO' }), a)).toBe(false);
  });
  test('invalid phone cannot form a contact link', () => { expect(telefoneTecnico('abc')).toBeNull(); expect(telefoneTecnico('81900000001')).toBe('5581900000001'); });
  test('zero changed rows cannot claim success', async () => { const f = fixture('zero'); await expect(confirmCommercialFollowUp(f.store, identity, 'TESTE', 'test')).rejects.toThrow('confirmar a gravação'); expect(f.counts().historyCount).toBe(0); });
  test('history failure is explicit while persisted confirmation stays saved', async () => { const f = fixture('history-failure'); const r = await confirmCommercialFollowUp(f.store, identity, 'TESTE', 'test'); expect(r.historyPending).toBe(true); expect(f.row().status).toBe('concluido'); });
  test('response lost after commit reads persisted state without a second update', async () => { const f = fixture('lost-response'); const r = await confirmCommercialFollowUp(f.store, identity, 'TESTE', 'test'); expect(r.row.status).toBe('concluido'); expect(f.counts().updateCount).toBe(1); });
  test('double click and repeat confirmation create one update and history', async () => { const f = fixture(); const [a,b] = await Promise.all([confirmCommercialFollowUp(f.store, identity, 'TESTE', 'test'), confirmCommercialFollowUp(f.store, identity, 'TESTE', 'test')]); expect(a.row.concluido_em).toBe(b.row.concluido_em); await confirmCommercialFollowUp(f.store, identity, 'TESTE', 'test'); expect(f.counts()).toEqual({ updateCount: 1, historyCount: 1 }); });
  test('wrong unit read-back cannot confirm a different record', async () => { const f = fixture(); f.store.read = async () => ({ data: { ...original, unidade_id: 'other' } }); await expect(confirmCommercialFollowUp(f.store, identity, 'TESTE', 'test')).rejects.toThrow('unidade'); expect(f.counts().updateCount).toBe(0); });
  test('another client wins a conditional update: losing client inserts no history', async () => { const f = fixture(); let reads = 0; f.store.read = async () => ({ data: ++reads === 1 ? original : { ...original, status: 'concluido', concluido_em: '2026-11-04T12:00:00Z' } }); f.store.completePending = async () => ({ data: null }); const result = await confirmCommercialFollowUp(f.store, identity, 'TESTE', 'test'); expect(result.alreadyConfirmed).toBe(true); expect(f.counts().historyCount).toBe(0); });
  test('history identity is stable across concurrent clients and distinct per follow-up', async () => { const at = '2026-11-04T12:00:00Z'; const [a,b,c] = await Promise.all([commercialHistoryId('A',at),commercialHistoryId('A',at),commercialHistoryId('B',at)]); expect(a).toBe(b); expect(a).not.toBe(c); expect(a).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/); });
  test('default BV on a technical task does not reclassify its family', () => { const item = taskFuItem({ id:'t',titulo:'ALFA',unidade_id:'one',prazo:'2026-11-04',status:'a_fazer',arquivada:false,fu_matriculados_etapa:'BV',fu_tecnico_etapa:'M+7',fu_tecnico_lead_id:'alfa',fu_tecnico_matricula_id:'e' } as Task); expect(item?.family).toBe('tecnico'); expect(item?.stage).toBe('M+7'); });
  test('confirmed M15 leaves message queue but accompaniment stays open after serialization', () => {
    const task = { id: 't', titulo: 'ALFA', unidade_id: 'one', prazo: '2026-11-04', status: 'a_fazer', arquivada: false, fu_gerencial_etapa: 'M+15', fu_gerencial_lead_id: 'alfa', fu_gerencial_matricula_id: 'e', fu_gerencial_status: 'pendente', fu_gerencial_confirmado_em: '2026-11-04T12:00:00Z' } as Task;
    const item = taskFuItem(JSON.parse(JSON.stringify(task))); expect(item).not.toBeNull(); if (!item) return;
    expect(pendingFuMessages([item], '2026-11-04')).toHaveLength(0); expect(confirmedFuToday([item], '2026-11-04')).toHaveLength(1); expect(item.open).toBe(true);
  });
  test('weekend pending message belongs to next Monday only', () => { const item = taskFuItem({ id:'t', titulo:'ALFA', unidade_id:'one', prazo:'2026-11-07', status:'a_fazer', arquivada:false, fu_matriculados_etapa:'M+3', fu_matriculados_lead_id:'alfa', fu_matriculados_matricula_id:'e' } as Task); if (!item) throw new Error('missing'); expect(item.due).toBe('2026-11-09'); expect(pendingFuMessages([item], '2026-11-07')).toHaveLength(0); expect(pendingFuMessages([item], '2026-11-09')).toHaveLength(1); });
});