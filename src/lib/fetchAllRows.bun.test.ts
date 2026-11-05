import { describe, test, expect } from 'bun:test';
import { fetchAllRows } from './fetchAllRows';

describe('Complete frontend totals', () => {
  test('2501 records contribute 25010, with identical unit/period filters on every page', async () => {
    const source = Array.from({ length: 2501 }, (_, id) => ({ id, unit: 'A', period: '2026', value: 10 }));
    const calls: number[] = [];
    const result = await fetchAllRows(async (from, to) => {
      calls.push(from);
      const filtered = source.filter(r => r.unit === 'A' && r.period === '2026');
      return { data: filtered.slice(from, to + 1), error: null, count: filtered.length };
    });
    expect(calls).toEqual([0, 500, 1000, 1500, 2000, 2500]);
    expect(result.data?.length).toBe(2501);
    expect(result.data?.reduce((sum, r) => sum + r.value, 0)).toBe(25010);
  });
  test('a failed later page never returns the first 500 rows as a total', async () => {
    const result = await fetchAllRows(async from => from === 0
      ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null, count: 600 }
      : { data: null, error: new Error('network') });
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
  test('a lower API cap cannot silently truncate the total', async () => {
    const result = await fetchAllRows(async () => ({ data: [{ id: 1 }], error: null, count: 2501 }));
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
  test('changing totals during pagination require a retry', async () => {
    const result = await fetchAllRows(async from => ({ data: Array.from({ length: 500 }, (_, id) => ({ id: from + id })), error: null, count: from === 0 ? 1000 : 1001 }));
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
  test('empty and exact page multiples finish without duplicating records', async () => {
    expect((await fetchAllRows(async () => ({ data: [], error: null, count: 0 }))).data).toEqual([]);
    const result = await fetchAllRows(async (from, to) => ({ data: Array.from({ length: 1000 }, (_, id) => ({ id })).slice(from, to + 1), error: null, count: 1000 }));
    expect(new Set(result.data?.map(r => r.id)).size).toBe(1000);
  });
});