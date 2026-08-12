import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { projetarMes, projetarMeses, type ForecastPremissas } from '@/lib/forecast/calc';

const fmt = (v: number | null | undefined, dec = 0) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const brl = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

interface Props {
  premissas: ForecastPremissas;
  baseInicial: number | null;
  ano: number;
  mes: number;
}

export function SimuladorCard({ premissas, baseInicial, ano, mes }: Props) {
  const [investimento, setInvestimento] = useState<number>(premissas.investimentoPrevisto || 0);
  const [churn, setChurn] = useState<number>(Math.round(premissas.churnMensal * 1000) / 10);
  const [taxaMatricula, setTaxaMatricula] = useState<number>(Math.round(premissas.taxaComparecimentoMatricula * 1000) / 10);
  const [base, setBase] = useState<string>(baseInicial != null ? String(baseInicial) : '');

  const premissasSim: ForecastPremissas = useMemo(
    () => ({
      ...premissas,
      investimentoPrevisto: investimento,
      churnMensal: churn / 100,
      taxaComparecimentoMatricula: taxaMatricula / 100,
    }),
    [premissas, investimento, churn, taxaMatricula],
  );

  const baseNum = Number(String(base).replace(',', '.'));
  const temBase = Number.isFinite(baseNum);

  const mesAtual = useMemo(
    () => (temBase ? projetarMes({ ano, mes, baseInicial: baseNum, premissas: premissasSim }) : null),
    [temBase, baseNum, premissasSim, ano, mes],
  );

  const doze = useMemo(
    () =>
      temBase
        ? projetarMeses({
            anoInicial: ano,
            mesInicial: mes,
            baseInicial: baseNum,
            meses: 12,
            premissasPorMes: () => premissasSim,
          })
        : [],
    [temBase, baseNum, premissasSim, ano, mes],
  );

  const ultimo = doze[doze.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Simulador de cenário</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Base de alunos ativos hoje</Label>
            <Input value={base} onChange={(e) => setBase(e.target.value)} inputMode="numeric" placeholder="—" />
          </div>
          <div className="space-y-1.5">
            <Label>Investimento mensal (R$)</Label>
            <Input
              value={String(investimento)}
              onChange={(e) => setInvestimento(Number(String(e.target.value).replace(',', '.')) || 0)}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-3">
            <Label>Churn mensal: {fmt(churn, 1)}%</Label>
            <Slider value={[churn]} onValueChange={(v) => setChurn(v[0])} min={0} max={20} step={0.5} />
          </div>
          <div className="space-y-3">
            <Label>Comparecimento → Matrícula: {fmt(taxaMatricula, 1)}%</Label>
            <Slider value={[taxaMatricula]} onValueChange={(v) => setTaxaMatricula(v[0])} min={0} max={100} step={1} />
          </div>
        </div>

        {!temBase ? (
          <p className="text-sm text-muted-foreground">Informe a base de alunos ativos para simular.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Matrículas no mês', valor: fmt(mesAtual?.matriculas, 1) },
              { label: 'Base no fim do mês', valor: fmt(mesAtual?.baseFinal, 1) },
              { label: 'CAC simulado', valor: brl(mesAtual?.cac) },
              { label: 'Base em 12 meses', valor: fmt(ultimo?.baseFinal, 1) },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{kpi.valor}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
