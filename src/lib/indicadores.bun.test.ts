import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { differenceInCalendarDays, subDays } from 'date-fns';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('Fase 3 — indicadores', () => {
  test('últimos 7 e 30 dias têm exatamente 7 e 30 dias', () => {
    const s = src('pages/DashboardExecutivo.tsx');
    expect(s).toContain('subDays(today, 6)');
    expect(s).toContain('subDays(today, 29)');
    const today = new Date(2026, 10, 4);
    expect(differenceInCalendarDays(today, subDays(today, 6)) + 1).toBe(7);
    expect(differenceInCalendarDays(today, subDays(today, 29)) + 1).toBe(30);
  });

  test('conversão no mesmo dia independe da ordem das experimentais', () => {
    const exp = [
      { lead_id: 'L1', compareceu: true, data_experimental: '2026-11-02' },
      { lead_id: 'L1', compareceu: true, data_experimental: '2026-11-03' },
    ];
    const mats = [{ lead_id: 'L1', data_fechamento: '2026-11-02' }];
    const count = (rows: typeof exp) => {
      const map = new Map<string, Set<string>>();
      rows.forEach(e => { const d = map.get(e.lead_id) ?? new Set<string>(); d.add(e.data_experimental); map.set(e.lead_id, d); });
      return new Set(mats.filter(m => map.get(m.lead_id)?.has(m.data_fechamento)).map(m => m.lead_id)).size;
    };
    expect(count(exp)).toBe(1);
    expect(count([...exp].reverse())).toBe(1);
    expect(src('hooks/useDashboardStats.ts')).toContain('dataExperimentalPorLead.get(m.lead_id)?.has(m.data_fechamento)');
  });

  test('limite do dia operacional inclui 22h de Recife', () => {
    expect(src('hooks/useOperacionalDashboard.ts')).toContain('T23:59:59.999999-03:00');
    const registro = new Date('2026-01-11T01:00:00Z'); // 10/01 22:00 Recife
    expect(registro <= new Date('2026-01-10T23:59:59.999-03:00')).toBe(true);
  });

  test('comissões ignoram resposta antiga de outra unidade', () => {
    const s = src('hooks/useComissoesData.ts');
    expect(s).toMatch(/if \(requestId !== requestIdRef\.current\) return;/);
  });
});

import { calcularConversaoCoorte } from '@/hooks/useExecutivoMetrics';
describe('Fase 3 — coorte executivo', () => {
  test('3 de 4 leads captados matriculados = 75%', () => {
    const r = calcularConversaoCoorte([
      { id: 'a', is_matriculado: true, status_funil: 'convertido' },
      { id: 'b', is_matriculado: false, status_funil: 'convertido' },
      { id: 'c', is_matriculado: true, status_funil: 'novo' },
      { id: 'd', is_matriculado: false, status_funil: 'perdido' },
    ] as any);
    expect(r).toEqual({ matriculasCoorte: 3, taxaConversaoCoorte: 75 });
  });
  test('sem leads captados = 0%', () => {
    expect(calcularConversaoCoorte([]).taxaConversaoCoorte).toBe(0);
  });
});
