import { useState } from 'react';
import { Gauge, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import type { IndiceComponente } from '@/lib/operacionalDashboard';

interface Props {
  indice: number | null;
  indiceAnterior: number | null;
  componentes: IndiceComponente[];
  pesoUtilizado: number;
  porUnidade: { unidade: string; indice: number | null }[];
}

export function IndiceOperacionalCard({ indice, indiceAnterior, componentes, pesoUtilizado, porUnidade }: Props) {
  const [open, setOpen] = useState(false);
  const delta = indice !== null && indiceAnterior !== null ? indice - indiceAnterior : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              Índice Operacional EVO
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setOpen(true)}>
              <Info className="w-3 h-3" /> Entenda o cálculo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {indice === null ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem avaliações registradas no período selecionado.</p>
          ) : (
            <>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-bold">{indice.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground mb-1">/ 100</span>
                {delta !== null && (
                  <span className={`mb-1 flex items-center gap-1 text-xs font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)} vs período anterior
                  </span>
                )}
              </div>
              <Progress value={indice} className="h-2" />

              <div className="grid gap-1.5 sm:grid-cols-2">
                {componentes.map((c) => {
                  const varc = c.media !== null && c.mediaAnterior !== null ? c.media - c.mediaAnterior : null;
                  return (
                    <div key={c.key} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                      <span className="text-muted-foreground">
                        {c.label} <span className="opacity-60">({c.peso}%)</span>
                      </span>
                      <span className="font-medium flex items-center gap-1">
                        {c.percentual === null ? 'Sem registro' : `${c.percentual.toFixed(0)}%`}
                        {varc !== null && Math.abs(varc) >= 0.05 && (
                          <span className={varc > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {varc > 0 ? '↑' : '↓'}
                            {Math.abs(varc).toFixed(1)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              {porUnidade.length > 1 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {porUnidade.map((u) => (
                    <div key={u.unidade} className="rounded-md bg-muted/50 px-2 py-1 text-xs">
                      <span className="text-muted-foreground">{u.unidade}: </span>
                      <span className="font-semibold">{u.indice === null ? 'Sem registro' : u.indice.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Como o Índice Operacional EVO é calculado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Cada nota de 1 a 5 é convertida em percentual (nota ÷ 5 × 100) e recebe um peso. Indicadores sem registro no período são
              excluídos e os pesos são renormalizados — o peso considerado neste período foi {pesoUtilizado}%.
            </p>
            <div className="rounded-md border divide-y">
              {componentes.map((c) => (
                <div key={c.key} className="flex items-center justify-between p-2 text-xs">
                  <span>
                    {c.label} · peso {c.peso}%
                  </span>
                  <span className="text-muted-foreground">
                    {c.media === null ? 'sem registro' : `${c.media.toFixed(2)}/5 → ${(c.percentual as number).toFixed(0)}%`}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Exemplo: nota 4,5 de 5 equivale a 90%. O índice final é a média ponderada dos percentuais dos indicadores com registro.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
