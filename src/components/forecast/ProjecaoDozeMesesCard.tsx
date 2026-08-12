import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ForecastMes } from '@/lib/forecast/calc';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmt = (v: number | null | undefined, dec = 0) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const brl = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function ProjecaoDozeMesesCard({ meses }: { meses: ForecastMes[] }) {
  if (meses.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Cadastre as premissas para projetar os próximos 12 meses.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Projeção dos próximos 12 meses</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-2 py-2 text-left font-medium">Mês</th>
              <th className="px-2 py-2 text-right font-medium">Investimento</th>
              <th className="px-2 py-2 text-right font-medium">Matrículas</th>
              <th className="px-2 py-2 text-right font-medium">Cancelamentos</th>
              <th className="px-2 py-2 text-right font-medium">Base final</th>
              <th className="px-2 py-2 text-right font-medium">Ocupação</th>
              <th className="px-2 py-2 text-right font-medium">Receita</th>
              <th className="px-2 py-2 text-right font-medium">CAC</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={`${m.ano}-${m.mes}`} className="border-b last:border-0">
                <td className="px-2 py-2 whitespace-nowrap">
                  {MESES[m.mes - 1]}/{String(m.ano).slice(2)}
                  {m.capacidadeAtingida && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      lotado
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{brl(m.funil.investimento)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(m.matriculas, 1)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(m.cancelamentos, 1)}</td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{fmt(m.baseFinal, 1)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{m.ocupacao == null ? '—' : `${fmt(m.ocupacao, 1)}%`}</td>
                <td className="px-2 py-2 text-right tabular-nums">{brl(m.receitaPrevista)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{brl(m.cac)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
