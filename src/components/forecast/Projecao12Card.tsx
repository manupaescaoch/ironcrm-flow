import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarraProgresso, SectionCard } from './ForecastUI';
import {
  LinhaProjecao,
  Premissas,
  calcTotais,
  fmtInt,
  fmtMoeda0,
  fmtPct,
  primeiroMesAtingindo,
} from '@/lib/forecast';

export function Projecao12Card({
  linhas,
  premissas,
}: {
  linhas: LinhaProjecao[];
  premissas: Premissas;
}) {
  const totais = calcTotais(linhas);
  const marcos = [
    { alvo: premissas.metaAlunos, label: 'Meta', cor: 'hsl(var(--primary))' },
    { alvo: premissas.capacidade * 0.8, label: '80% cap.', cor: '#f59e0b' },
    { alvo: premissas.capacidade * 0.9, label: '90% cap.', cor: '#f97316' },
    { alvo: premissas.capacidade, label: '100% cap.', cor: '#ef4444' },
  ]
    .map((m) => ({ ...m, linha: primeiroMesAtingindo(linhas, m.alvo) }))
    .filter((m) => m.linha);

  const dados = linhas.map((l) => ({
    label: l.label,
    base: l.alunosAtivos,
    meta: premissas.metaAlunos || null,
    capacidade: premissas.capacidade || null,
  }));

  return (
    <SectionCard
      title="Projeção dos próximos 12 meses"
      subtitle="A base final de cada mês vira automaticamente a base inicial do mês seguinte."
    >
      <div className="overflow-x-auto -mx-2 px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Mês</TableHead>
              <TableHead className="text-xs text-right">Matrículas</TableHead>
              <TableHead className="text-xs text-right">Evasões</TableHead>
              <TableHead className="text-xs text-right">Cresc. líquido</TableHead>
              <TableHead className="text-xs text-right">Alunos ativos</TableHead>
              <TableHead className="text-xs text-right">Receita do mês</TableHead>
              <TableHead className="text-xs text-right">Ocupação</TableHead>
              <TableHead className="text-xs w-[130px]">Evolução</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l) => (
              <TableRow key={`${l.ano}-${l.mes}`}>
                <TableCell className="text-xs font-medium whitespace-nowrap">{l.label}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{fmtInt(l.matriculas)}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{fmtInt(l.evasoes)}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">
                  {l.crescimentoLiquido > 0 ? '+' : ''}
                  {fmtInt(Math.abs(l.crescimentoLiquido))}
                </TableCell>
                <TableCell className="text-xs text-right tabular-nums font-semibold">{fmtInt(l.alunosAtivos)}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{fmtMoeda0(l.receita)}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{fmtPct(l.ocupacao)}</TableCell>
                <TableCell>
                  <BarraProgresso valor={l.alunosAtivos} max={premissas.capacidade} />
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell className="text-xs">TOTAL 12 MESES</TableCell>
              <TableCell className="text-xs text-right tabular-nums">{fmtInt(totais.matriculas)}</TableCell>
              <TableCell className="text-xs text-right tabular-nums">{fmtInt(totais.evasoes)}</TableCell>
              <TableCell className="text-xs text-right tabular-nums">
                {totais.crescimentoLiquido > 0 ? '+' : ''}
                {fmtInt(Math.abs(totais.crescimentoLiquido))}
              </TableCell>
              <TableCell className="text-xs text-right tabular-nums">
                {fmtInt(linhas[linhas.length - 1]?.alunosAtivos ?? 0)}
              </TableCell>
              <TableCell className="text-xs text-right tabular-nums">{fmtMoeda0(totais.receita)}</TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={44} />
            <ReTooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(v: number) => fmtInt(v)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="base" name="Base projetada" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="meta" name="Meta de alunos" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
            <Line type="monotone" dataKey="capacidade" name="Capacidade máxima" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
            {marcos.map((m) => (
              <ReferenceDot
                key={m.label}
                x={m.linha!.label}
                y={m.linha!.alunosAtivos}
                r={5}
                fill={m.cor}
                stroke="hsl(var(--background))"
                label={{ value: m.label, position: 'top', fontSize: 10, fill: m.cor }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
