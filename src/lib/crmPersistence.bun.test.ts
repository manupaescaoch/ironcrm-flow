import { test, expect } from 'bun:test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
// Execute the actual page functions with isolated transport, not copied business logic.
const crm = readFileSync('src/pages/CRM.tsx', 'utf8');
const kanban = readFileSync('src/pages/Kanban.tsx', 'utf8');
const detail = readFileSync('src/pages/LeadDetail.tsx', 'utf8');
function compile(source: string, bindings: Record<string, unknown>, result: string) {
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None });
  return new Function(...Object.keys(bindings), `${js};return ${result}`)(...Object.values(bindings));
}
function deferred() {
  let resolve: (value: unknown) => void = () => {};
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
for (const [name, src, start, end] of [
  ['CRM', crm, '  const fetchLeads = useCallback', '\n\n  useEffect(() => {'],
  ['Kanban', kanban, '  const fetchLeads = async', '\n  // Extract unique values'],
] as const) {
  test(`${name}: late unit A result cannot replace unit B`, async () => {
    const pending = { A: deferred(), B: deferred() }; let visible: { unidade_id: string }[] = [];
    const leadRequest = { current: 0 }; const currentUnit = { current: 'A' };
    const db = { from(table: string) {
      let unit = 'A';
      const q = { select: () => q, eq: (key: string, value: string) => { if (key === 'unidade_id') unit = value; return q; }, order: () => q, range: () => q, in: () => q,
        then: (yes: (v: unknown) => unknown, no: (e: unknown) => unknown) => (table === 'interacoes' ? Promise.resolve({ data: [] }) : pending[unit as 'A' | 'B'].promise).then(yes, no) };
      return q;
    } };
    const code = src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));
    const make = (unit: string) => compile(code, { useCallback: (f: unknown) => f, unidadeAtual: { id: unit }, currentUnit, leadRequest, supabase: db, setLoading: () => {}, setLeads: (v: typeof visible) => { visible = v; }, toast: () => {} }, 'fetchLeads');
    const a = make('A')(); currentUnit.current = 'B'; const b = make('B')();
    pending.B.resolve({ data: [{ id: 'b', unidade_id: 'B' }], error: null }); await b;
    pending.A.resolve({ data: [{ id: 'a', unidade_id: 'A' }], error: null }); await a;
    expect(visible.map(v => v.unidade_id)).toEqual(['B']);
  });
}
test('CRM: selecting canonical cadastrador includes alias and accent variants', () => {
  const normalize = compile(crm.slice(crm.indexOf('const CADASTRADORES_VALIDOS'), crm.indexOf('// Normaliza origem')), {}, 'normalizeCadastrador');
  const expression = /const matchesCadastradoPor = ([^;]+);/.exec(crm)?.[1];
  if (!expression) throw new Error('filter missing');
  for (const raw of ['THAÍS', ' thais ']) {
    expect(compile(`const matches = ${expression}`, { lead: { cadastrado_por: raw }, filterCadastradoPor: 'THAIS', normalizeCadastrador: normalize }, 'matches')).toBe(true);
  }
});
test('CRM: phone fragment cannot bypass a nonmatching name', () => {
  const matches = compile(crm.slice(crm.indexOf('const normalizeText'), crm.indexOf('export default function CRM')), {}, 'matchesLeadSearch');
  const lead = { nome: 'MARIA', telefone: '11987654321' };
  expect(matches(lead, 'João 54321')).toBe(false);
  expect(matches(lead, 'Maria 54321')).toBe(true);
  expect(matches(lead, '(11) 98765-4321')).toBe(true);
});
test('Lead edit: zero-row save preserves original baseline and cannot claim success', async () => {
  const code = detail.slice(detail.indexOf('  const handleSaveLead = async'), detail.indexOf('  const handleConfirmPerda'));
  let advanced = false; const titles: string[] = []; const scopes: string[][] = [];
  const lead = { id: 'lead', unidade_id: 'A', nome: 'EDITADO', telefone: '81900000001' };
  const q = { update: () => q, eq: (k: string, v: string) => { scopes.push([k, v]); return q; }, select: () => q, single: async () => ({ data: null, error: null }) };
  const handle = compile(code, { lead, originalLead: { ...lead, nome: 'ORIGINAL' }, id: lead.id, supabase: { from: () => q }, setSaving: () => {}, toast: (t: { title: string }) => titles.push(t.title), getErrorMessage: () => '', setLead: () => {}, setOriginalLead: () => { advanced = true; } }, 'handleSaveLead');
  await handle(); expect(advanced).toBe(false); expect(titles).toEqual(['Erro ao salvar']); expect(scopes).toContainEqual(['unidade_id', 'A']);
});
test('Lead edit: returned persisted row becomes baseline, not the optimistic draft', async () => {
  const code = detail.slice(detail.indexOf('  const handleSaveLead = async'), detail.indexOf('  const handleConfirmPerda'));
  const lead = { id: 'lead', unidade_id: 'A', nome: 'editado', telefone: '81900000001' };
  const saved = { ...lead, nome: 'EDITADO' }; let baseline: unknown;
  const q = { update: () => q, eq: () => q, select: () => q, single: async () => ({ data: saved, error: null }) };
  const handle = compile(code, { lead, originalLead: { ...lead, nome: 'ORIGINAL' }, id: lead.id, supabase: { from: () => q }, setSaving: () => {}, toast: () => {}, getErrorMessage: () => '', setLead: () => {}, setOriginalLead: (v: unknown) => { baseline = v; } }, 'handleSaveLead');
  await handle(); expect(baseline).toEqual(saved);
});
for (const [mode, data] of [['zero', null], ['wrong-unit', { id: 'lead', unidade_id: 'B', ativo: false }], ['saved', { id: 'lead', unidade_id: 'A', ativo: false }]] as const) {
  test(`CRM archival: ${mode} verifies unit and persistence before refreshing`, async () => {
    const code = crm.slice(crm.indexOf('  const handleDelete = async'), crm.indexOf('  // Parse CSV file'));
    const titles: string[] = []; let refreshed = 0; let rows = [{ id: 'lead' }];
    const q = { update: () => q, eq: () => q, select: () => q, single: async () => ({ data, error: null }) };
    const handle = compile(code, { unidadeAtual: { id: 'A' }, leadToDelete: 'lead', currentUnit: { current: 'A' }, supabase: { from: () => q }, toast: (t: { title: string }) => titles.push(t.title), getErrorMessage: () => '', setLeads: (f: (v: typeof rows) => typeof rows) => { rows = f(rows); }, fetchLeads: () => { refreshed++; }, setDeleteDialogOpen: () => {}, setLeadToDelete: () => {} }, 'handleDelete');
    await handle(); expect(titles).toEqual([mode === 'saved' ? 'Lead excluído com sucesso!' : 'Erro ao excluir lead']);
    expect(refreshed).toBe(mode === 'saved' ? 1 : 0); expect(rows.length).toBe(mode === 'saved' ? 0 : 1);
  });
}