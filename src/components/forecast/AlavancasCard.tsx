import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SectionCard } from './ForecastUI';
import { Alavanca, fmtInt, fmtMoeda0 } from '@/lib/forecast';

export function AlavancasCard({ alavancas }: { alavancas: Alavanca[] }) {
  return (
    <SectionCard
      title="Qual alavanca mais muda o resultado?"
      subtitle="Ordenado pelo ganho de alunos em 12 meses, mantendo as demais premissas constantes."
    >
      <div className="overflow-x-auto -mx-2 px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Alavanca</TableHead>
              <TableHead className="text-xs text-right">Matrículas adicionais/mês</TableHead>
              <TableHead className="text-xs text-right">Cresc. líquido adicional</TableHead>
              <TableHead className="text-xs text-right">Alunos adicionais em 12 meses</TableHead>
              <TableHead className="text-xs text-right">Receita adicional em 12 meses</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alavancas.map((a, i) => (
              <TableRow key={a.id} className={i === 0 ? 'bg-emerald-500/5' : undefined}>
                <TableCell className="text-xs font-medium whitespace-nowrap">{a.label}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">
                  {a.matriculasAdicionais > 0 ? '+' : ''}
                  {fmtInt(Math.abs(a.matriculasAdicionais))}
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums">
                  {a.crescimentoAdicional > 0 ? '+' : ''}
                  {fmtInt(Math.abs(a.crescimentoAdicional))}
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums font-semibold">
                  {a.alunosAdicionais12m > 0 ? '+' : ''}
                  {fmtInt(Math.abs(a.alunosAdicionais12m))}
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums">
                  {a.receitaAdicional12m > 0 ? '+' : ''}
                  {fmtMoeda0(Math.abs(a.receitaAdicional12m))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
