import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { metaReversa, type ForecastPremissas } from '@/lib/forecast/calc';

const fmt = (v: number | null | undefined, dec = 0) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const brl = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  premissas: ForecastPremissas;
  baseInicial: number | null;
  metaSugerida: number | null;
}

export function MetaReversaCard({ premissas, baseInicial, metaSugerida }: Props) {
  const [meta, setMeta] = useState(metaSugerida != null ? String(metaSugerida) : '');
  const [base, setBase] = useState(baseInicial != null ? String(baseInicial) : '');

  const resultado = useMemo(() => {
    const metaNum = Number(String(meta).replace(',', '.'));
    const baseNum = Number(String(base).replace(',', '.'));
    if (!Number.isFinite(metaNum) || !Number.isFinite(baseNum)) return null;
    return metaReversa({ metaAlunosAtivos: metaNum, baseInicial: baseNum, premissas });
  }, [meta, base, premissas]);

  const linhas = [
    { label: 'Matrículas necessárias', valor: fmt(resultado?.matriculasNecessarias, 1) },
    { label: 'Comparecimentos necessários', valor: fmt(resultado?.comparecimentosNecessarios, 1) },
    { label: 'Agendamentos necessários', valor: fmt(resultado?.agendamentosNecessarios, 1) },
    { label: 'Leads necessários', valor: fmt(resultado?.leadsNecessarios, 1) },
    { label: 'Conversas necessárias', valor: fmt(resultado?.conversasNecessarias, 1) },
    { label: 'Investimento necessário', valor: brl(resultado?.investimentoNecessario), destaque: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta reversa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Meta de alunos ativos no fim do mês</Label>
            <Input value={meta} onChange={(e) => setMeta(e.target.value)} inputMode="numeric" placeholder="Ex.: 320" />
          </div>
          <div className="space-y-1.5">
            <Label>Base de alunos ativos hoje</Label>
            <Input value={base} onChange={(e) => setBase(e.target.value)} inputMode="numeric" placeholder="—" />
          </div>
        </div>

        {resultado === null ? (
          <p className="text-sm text-muted-foreground">Informe a meta e a base atual para calcular.</p>
        ) : (
          <div className="space-y-2">
            {linhas.map((l) => (
              <div
                key={l.label}
                className={`flex items-center justify-between rounded-md px-3 py-2 ${l.destaque ? 'bg-primary/10' : 'bg-muted/40'}`}
              >
                <span className="text-sm">{l.label}</span>
                <span className={`tabular-nums ${l.destaque ? 'text-base font-bold' : 'text-sm font-semibold'}`}>{l.valor}</span>
              </div>
            ))}
            {resultado.investimentoNecessario == null && (
              <p className="text-xs text-muted-foreground">
                Preencha todas as taxas do funil e o custo por conversa nas premissas para chegar ao investimento.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
