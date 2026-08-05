import { useMemo, useState } from 'react';
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

export function AtendimentosTreinadorCard({ dados, mediaEquipe }: { dados: Treinador[]; mediaEquipe?: number | null }) {
  const [sel, setSel] = useState<Treinador | null>(null);

  // Sempre segmentado por unidade: rankings e médias nunca misturam unidades.
  const grupos = useMemo(() => {
    const unidades = [...new Set(dados.map((t) => t.unidade))].sort();
    return unidades.map((unidade) => {
      const itens = dados.filter((t) => t.unidade === unidade).sort((a, b) => b.total - a.total);
      const media = itens.length ? itens.reduce((a, t) => a + t.total, 0) / itens.length : null;
      return { unidade, itens: itens.map((t) => ({ ...t, name: t.treinador })), media };
    });
  }, [dados]);

  const mediaDaUnidade = (unidade: string) => grupos.find((g) => g.unidade === unidade)?.media ?? null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Atendimentos por treinador
          </CardTitle>
          <p className="text-xs text-muted-foreground">Separado por unidade · clique em uma barra para ver o detalhamento</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {grupos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem atendimentos registrados no período selecionado.</p>
          ) : (
            grupos.map((g) => (
              <div key={g.unidade}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{g.unidade}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.itens.length} treinador(es) · média {g.media !== null ? g.media.toFixed(1) : '—'}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(160, g.itens.length * 28)}>
                  <BarChart data={g.itens} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const t = payload[0].payload as Treinador;
                        return (
                          <div className="rounded-md border bg-popover p-2 text-xs shadow-md">
                            <p className="font-semibold">{t.treinador}</p>
                            <p>{t.unidade}</p>
                            <p>{t.total} atendimentos</p>
                            <p>Média diária: {t.mediaDiaria.toFixed(1)}</p>
                            <p>{t.turnos.join(', ')}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} onClick={(d: any) => setSel(d.payload as Treinador)} cursor="pointer">
                      {g.itens.map((t) => (
                        <Cell
                          key={`${g.unidade}-${t.treinador}`}
                          fill={g.media !== null && t.total < g.media ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{sel ? `${sel.treinador} · ${sel.unidade}` : ''}</DialogTitle>
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
                  <p className="text-xs text-muted-foreground">Unidade</p>
                  <p className="font-semibold text-xs">{sel.unidade}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">Média da unidade</p>
                  <p className="font-semibold">
                    {(() => {
                      const m = mediaDaUnidade(sel.unidade);
                      return m === null ? 'Sem dados' : m.toFixed(1);
                    })()}
                    {mediaDaUnidade(sel.unidade) !== null && (
                      <Badge variant={sel.total >= (mediaDaUnidade(sel.unidade) as number) ? 'default' : 'secondary'} className="ml-2 text-[10px]">
                        {sel.total >= (mediaDaUnidade(sel.unidade) as number) ? 'acima' : 'abaixo'}
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
