import { test, expect } from 'bun:test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

test('Dashboard initial loading and unit/period reload never generate follow-ups', async () => {
  const source = readFileSync('src/hooks/useDashboardData.ts', 'utf8');
  const start = source.indexOf('  useEffect(() => {');
  const end = source.indexOf('\n\n  return {', start);
  if (start < 0 || end < 0) throw new Error('Dashboard effect missing');
  const code = ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2022 });
  let reads = 0;
  let generations = 0;
  const run = new Function('useEffect', 'unidadeAtual', 'followUpsHook', 'refetchAll', 'startDate', 'endDate', code);
  for (const id of ['unit-a', 'unit-b']) {
    for (const month of [9, 10]) {
      run((effect: () => void) => effect(), { id }, { generateFollowUps: () => generations++ }, () => reads++, new Date(2026, month, 1), new Date(2026, month + 1, 0));
    }
  }
  expect(reads).toBe(4);
  expect(generations).toBe(0);
});