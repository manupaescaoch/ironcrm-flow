import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, AlertTriangle } from 'lucide-react';
import type { ForecastMes } from '@/lib/forecast/calc';
import type { RealizadoAuto } from '@/hooks/useForecast';

const fmt = (v: number | null | undefined, dec = 0) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const brl = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  projecao: ForecastMes;
  realizado?: RealizadoAuto;
}

export function FunilForecastCard({ projecao, realizado }: Props) {
  const etapas = [
    { label: 'Investimento', previsto: brl(projecao.funil.investimento), realizado: brl(realizado?.investimento ?? null) },
    { label: 'Conversas iniciadas', previsto: fmt(projecao.funil.conversas), realizado: '—' },
    { label: 'Leads no CRM', previsto: fmt(projecao.funil.leads), realizado: fmt(realizado?.leads) },
    { label: 'Agendamentos', previsto: fmt(projecao.funil.agendamentos), realizado: fmt(realizado?.agendamentos) },
    { label: 'Comparecimentos', previsto: fmt(projecao.funil.comparecimentos), realizado: fmt(realizado?.comparecimentos) },
    { label: 'Matrículas', previsto: fmt(projecao.funil.matriculas), realizado: fmt(realizado?.matriculas) },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Funil do mês</CardTitle>
        {projecao.funil.conversas == null && (
          <Badge variant="outline" className="gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" /> Informe o custo por conversa
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 pb-1 text-xs font-medium text-muted-foreground">
          <span>Etapa</span>
          <span className="text-right">Previsto</span>
          <span className="text-right">Realizado</span>
        </div>
        {etapas.map((e, i) => (
          <div key={e.label}>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 rounded-md bg-muted/40 px-3 py-2">
              <span className="text-sm">{e.label}</span>
              <span className="text-right text-sm font-semibold tabular-nums">{e.previsto}</span>
              <span className="text-right text-sm tabular-nums text-muted-foreground">{e.realizado}</span>
            </div>
            {i < etapas.length - 1 && (
              <div className="flex justify-center py-0.5">
                <ArrowDown className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
