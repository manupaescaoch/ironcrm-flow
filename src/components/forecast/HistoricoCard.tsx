import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';
import { SectionCard } from './ForecastUI';
import { RealizadoRow } from '@/hooks/useForecastData';
import { fmtInt, fmtMesAno, fmtPct, num, pessoas, safeDiv } from '@/lib/forecast';

export function HistoricoCard({ rows }: { rows: RealizadoRow[] }) {
  const ordenadas = [...rows].sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes));

  return (
    <SectionCard
      title="Histórico da base"
      subtitle="Fechamento consolidado de cada mês. Meses fechados não mudam retroativamente."
    >
      {ordenadas.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum mês registrado ainda. Use “Fechar mês” para consolidar o primeiro período.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-2 px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Mês</TableHead>
                <TableHead className="text-xs text-right">Alunos ativos</TableHead>
                <TableHead className="text-xs text-right">Novas matrículas</TableHead>
                <TableHead className="text-xs text-right">Taxa de evasão</TableHead>
                <TableHead className="text-xs text-right">Evasões</TableHead>
                <TableHead className="text-xs text-right">Cresc. líquido</TableHead>
                <TableHead className="text-xs text-right">Crescimento %</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenadas.map((r) => {
                const baseInicial = pessoas(r.base_inicial ?? 0);
                const evasoes = Math.min(baseInicial || Infinity, pessoas(r.cancelamentos ?? 0));
                const matriculas = pessoas(r.matriculas_total ?? 0);
                const cresc = matriculas - evasoes;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium whitespace-nowrap">{fmtMesAno(r.mes, r.ano)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-semibold">
                      {fmtInt(num(r.alunos_ativos ?? r.base_final ?? 0))}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmtInt(matriculas)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {fmtPct(safeDiv(evasoes, baseInicial))}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmtInt(evasoes)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {cresc > 0 ? '+' : ''}
                      {fmtInt(Math.abs(cresc))}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {fmtPct(safeDiv(cresc, baseInicial))}
                    </TableCell>
                    <TableCell>
                      {r.fechado ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          <Lock className="w-3 h-3 mr-1" /> Fechado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Aberto
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
