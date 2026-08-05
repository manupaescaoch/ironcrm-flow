import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseISODate } from '@/lib/operacionalDashboard';
import type { OperacionalDashboardData } from '@/hooks/useOperacionalDashboard';

type Treinador = OperacionalDashboardData['porTreinador'][number];

export function AtendimentosTreinadorCard({ dados, mediaEquipe }: { dados: Treinador[]; mediaEquipe: number | null }) {
  const [sel, setSel] = useState<Treinador | null>(null);

  const chartData = dados.map((t) => ({ ...t, name: t.treinador }));

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Atendimentos por treinador
          </CardTitle>
          <p className="text-xs text-muted-foreground">Clique em uma barra para ver o detalhamento</p>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem atendimentos registrados no período selecionado.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 28)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const t = payload[0].payload as Treinador;
                    return (
                      <div className="rounded-md border bg-popover p-2 text-xs shadow-md">
                        <p className="font-semibold">{t.treinador}</p>
                        <p>{t.total} atendimentos</p>
                        <p>Média diária: {t.mediaDiaria.toFixed(1)}</p>
                        <p>{t.unidades.join(', ')}</p>
                        <p>{t.turnos.join(', ')}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} onClick={(d: any) => setSel(d.payload as Treinador)} cursor="pointer">
                  {chartData.map((t) => (
                    <Cell
                      key={t.treinador}
                      fill={mediaEquipe !== null && t.total < mediaEquipe ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{sel?.treinador}</DialogTitle>
          </DialogHeader>
          {sel && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">Total no período</p>
                  <p className="font-semibold">{sel.total}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">Média diária</p>
                  <p className="font-semibold">{sel.mediaDiaria.toFixed(1)}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">Unidades</p>
                  <p className="font-semibold text-xs">{sel.unidades.join(', ')}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">Média da equipe</p>
                  <p className="font-semibold">
                    {mediaEquipe === null ? 'Sem dados' : mediaEquipe.toFixed(1)}
                    {mediaEquipe !== null && (
                      <Badge variant={sel.total >= mediaEquipe ? 'default' : 'secondary'} className="ml-2 text-[10px]">
                        {sel.total >= mediaEquipe ? 'acima' : 'abaixo'}
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
              <ScrollArea className="h-64 rounded-md border">
                <div className="divide-y">
                  {sel.registros.map((r, i) => (
                    <div key={`${r.formulario_id}-${i}`} className="flex items-center justify-between p-2 text-xs">
                      <span>{format(parseISODate(r.data), "dd/MM (EEE)", { locale: ptBR })}</span>
                      <span className="text-muted-foreground">{r.turno} · {r.unidade}</span>
                      <span className="font-semibold">{r.quantidade}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
