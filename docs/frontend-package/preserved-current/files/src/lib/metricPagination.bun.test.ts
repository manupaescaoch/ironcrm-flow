import { test, expect } from 'bun:test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { fetchAllRows } from './fetchAllRows';

test('real Dashboard stats loader counts 2501 unique experimentals and enrollments without changing ticket rules', async () => {
  const requests: Array<{ from: number; unit: string | undefined }> = [];
  const records = Array.from({ length: 2501 }, (_, n) => ({ lead_id: `lead-${n}`, compareceu: true, data_experimental: '2026-11-05', data_fechamento: '2026-11-05', valor_plano: 100 }));
  const supabase = {
    from() {
      let from = 0, to = 499, unit: string | undefined;
      const query = {
        select() { return query; },
        eq(key: string, value: string) { if (key === 'unidade_id') unit = value; return query; },
        gte() { return query; }, lte() { return query; }, order() { return query; },
        range(a: number, b: number) { from = a; to = b; return query; },
        then(resolve: (value: unknown) => unknown) {
          requests.push({ from, unit });
          return Promise.resolve({ data: records.slice(from, to + 1), count: records.length, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  const source = readFileSync('src/hooks/useDashboardStats.ts', 'utf8').replace(/^import .*;\n/gm, '').replace('export function', 'function');
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022 });
  const states: unknown[] = [];
  let index = 0;
  const useState = (initial: unknown) => { const i = index++; states[i] = initial; return [initial, (v: unknown) => { states[i] = v; }]; };
  const hook = new Function('useState', 'useCallback', 'supabase', 'useUnidade', 'format', 'startOfWeek', 'endOfWeek', 'fetchAllRows', js + '; return useDashboardStats();')(
    useState, (fn: unknown) => fn, supabase, () => ({ unidadeAtual: { id: 'fictional-unit-A' } }), () => '2026-11-05', (d: unknown) => d, (d: unknown) => d, fetchAllRows,
  );
  await hook.fetchPeriodStats(new Date(2026, 0, 1), new Date(2026, 10, 5));
  expect(states[1]).toEqual({ experimentaisPeriodo: 2501, comparecimentosPeriodo: 2501, matriculasPeriodo: 2501, conversaoMesmoDia: 2501, ticketMedioMes: 100, matriculasMes: 2501 });
  await hook.fetchWeeklyStats();
  expect(states[2]).toBe(2501);
  expect(requests.length).toBe(24);
  expect(requests.every(r => r.unit === 'fictional-unit-A')).toBe(true);
});