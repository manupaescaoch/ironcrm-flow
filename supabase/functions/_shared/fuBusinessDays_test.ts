import { addFuBusinessDays, diffFuBusinessDays, effectiveFuDay, fuDay, fuWeekKey } from './fuBusinessDays.ts';
function eq(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
Deno.test('FU offsets and ages count Monday-Friday only', () => {
  eq(fuDay(addFuBusinessDays('2026-10-16', 1)), '2026-10-19');
  eq(fuDay(addFuBusinessDays('2026-10-16', 7)), '2026-10-27');
  eq(diffFuBusinessDays('2026-10-16', '2026-10-18'), 0);
  eq(diffFuBusinessDays('2026-10-16', '2026-10-19'), 1);
});
Deno.test('Saturday and Sunday FU move to following Monday', () => {
  eq(effectiveFuDay('2026-10-17T00:00:00-03:00'), '2026-10-19');
  eq(effectiveFuDay('2026-10-18T00:00:00-03:00'), '2026-10-19');
  eq(effectiveFuDay('2026-10-16T00:00:00-03:00'), '2026-10-16');
});
Deno.test('Weekend FU belong only to next week and never duplicate the origin week', () => {
  const rows = [{ id: 'sat', due: '2026-10-17' }, { id: 'sun', due: '2026-10-18' }, { id: 'fri', due: '2026-10-16' }];
  const origin = rows.filter(row => fuWeekKey(row.due) === '2026-10-12');
  const next = rows.filter(row => fuWeekKey(row.due) === '2026-10-19');
  eq(origin.length, 1);
  eq(next.length, 2);
  eq(origin.some(row => next.some(other => row.id === other.id)), false);
  eq(fuWeekKey('2026-12-27'), '2026-12-28');
});