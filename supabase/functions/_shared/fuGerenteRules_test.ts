import { isManagerFuWeekday, managerFuStage, suppressManagerFu } from './fuGerenteRules.ts';

function eq(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
Deno.test('Telegram manager FU runs Monday through Friday, never Saturday/Sunday in Recife', () => {
  for (let day = 19; day <= 23; day++) eq(isManagerFuWeekday(new Date(`2026-10-${day}T11:00:00Z`)), true);
  eq(isManagerFuWeekday(new Date('2026-10-24T11:00:00Z')), false);
  eq(isManagerFuWeekday(new Date('2026-10-25T11:00:00Z')), false);
  eq(isManagerFuWeekday(new Date('2026-10-19T01:00:00Z')), false);
});
Deno.test('Manager FU age boundaries match the dashboard', () => {
  eq(managerFuStage('2026-10-13', '2026-10-19'), null);
  eq(managerFuStage('2026-10-12', '2026-10-19'), { tipo: 'G+7', atraso: 0 });
  eq(managerFuStage('2026-09-20', '2026-10-19'), { tipo: 'G+7', atraso: 22 });
  eq(managerFuStage('2026-09-19', '2026-10-19'), { tipo: 'G+30', atraso: 0 });
  eq(managerFuStage('2026-09-04', '2026-10-19'), { tipo: 'G+30', atraso: 15 });
  eq(managerFuStage('2026-09-03', '2026-10-19'), null);
});
Deno.test('Completed and future rescheduled FU are excluded', () => {
  eq(suppressManagerFu([{ status: 'concluido', data_prevista: null }], '2026-10-19'), true);
  eq(suppressManagerFu([{ status: 'pendente', data_prevista: '2026-10-20T00:00:00-03:00' }], '2026-10-19'), true);
  eq(suppressManagerFu([{ status: 'pendente', data_prevista: '2026-10-19T00:00:00-03:00' }], '2026-10-19'), false);
});