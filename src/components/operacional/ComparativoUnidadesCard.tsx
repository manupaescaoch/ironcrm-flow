import { useState } from 'react';
import { ArrowUpDown, Building2, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { classificarNota, NOTA_CLASSE_COLOR, NOTA_CLASSE_LABEL } from '@/lib/operacionalDashboard';
import type { OperacionalDashboardData } from '@/hooks/useOperacionalDashboard';

type Linha = OperacionalDashboardData['comparativo'][number];

const COLUNAS: { key: keyof Linha; label: string; tipo: 'num' | 'nota' | 'pct' }[] = [
  { key: 'atendimentos', label: 'Atend.', tipo: 'num' },
  { key: 'mediaTreinador', label: 'Média/treinador', tipo: 'num' },
  { key: 'experimentais', label: 'Exp.', tipo: 'num' },
  { key: 'limpeza', label: 'Limpeza', tipo: 'nota' },
  { key: 'organizacao', label: 'Organização', tipo: 'nota' },
  { key: 'climatizacao', label: 'Climat.', tipo: 'nota' },
  { key: 'equipamentos', label: 'Equip.', tipo: 'nota' },
  { key: 'clima', label: 'Clima', tipo: 'nota' },
  { key: 'presenca', label: 'Presença', tipo: 'pct' },
  { key: 'ocorrencias', label: 'Ocorr. abertas', tipo: 'num' },
  { key: 'taxaPreenchimento', label: 'Preenchimento', tipo: 'pct' },
];

const fmt = (v: number | null, tipo: 'num' | 'nota' | 'pct') => {
  if (v === null || v === undefined) return 'Sem registro';
  if (tipo === 'pct') return `${v.toFixed(0)}%`;
  if (tipo === 'nota') return v.toFixed(1);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

export function ComparativoUnidadesCard({ linhas }: { linhas: Linha[] }) {
  const [sortKey, setSortKey] = useState<keyof Linha>('atendimentos');
  const [asc, setAsc] = useState(false);
  const [detalhe, setDetalhe] = useState<Linha | null>(null);

  const ordenadas = [...linhas].sort((a, b) => {
    const va = a[sortKey] as number | null;
    const vb = b[sortKey] as number | null;
    if (va === null) return 1;
    if (vb === null) return -1;
    return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const toggle = (k: keyof Linha) => {
    if (k === sortKey) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Comparativo por unidade
          </CardTitle>
          <p className="text-xs text-muted-foreground">Clique no cabeçalho para ordenar por qualquer indicador</p>
        </CardHeader>
        <CardContent className="p-0">
          {linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Sem dados no período selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Unidade</TableHead>
                    {COLUNAS.map((c) => (
                      <TableHead key={c.key as string} className="text-xs whitespace-nowrap cursor-pointer" onClick={() => toggle(c.key)}>
                        <span className="inline-flex items-center gap-1">
                          {c.label}
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        </span>
                      </TableHead>
                    ))}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenadas.map((l) => (
                    <TableRow key={l.unidade}>
                      <TableCell className="font-medium text-xs whitespace-nowrap">{l.unidade}</TableCell>
                      {COLUNAS.map((c) => (
                        <TableCell key={c.key as string} className="text-xs whitespace-nowrap">
                          {fmt(l[c.key] as number | null, c.tipo)}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetalhe(l)}>
                          Detalhes <ChevronRight className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detalhe?.unidade}</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Índice Operacional EVO</p>
                <p className="text-2xl font-bold">{detalhe.indice === null ? 'Sem registro' : `${detalhe.indice.toFixed(1)}`}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {COLUNAS.map((c) => {
                  const v = detalhe[c.key] as number | null;
                  const classe = c.tipo === 'nota' ? classificarNota(v) : null;
                  return (
                    <div key={c.key as string} className="rounded-md border p-2">
                      <p className="text-[11px] text-muted-foreground">{c.label}</p>
                      <p className={`text-sm font-semibold ${classe ? NOTA_CLASSE_COLOR[classe] : ''}`}>
                        {fmt(v, c.tipo)}
                        {classe && <span className="ml-1 text-[10px] font-normal">{NOTA_CLASSE_LABEL[classe]}</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
