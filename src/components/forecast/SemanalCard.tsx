import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SectionCard, SinalBadge } from './ForecastUI';
import { SemanaRow, StatusSinal, fmtInt, fmtPct, num, safeDiv } from '@/lib/forecast';

const SITUACAO_LABEL: Record<SemanaRow['situacao'], { txt: string; status: StatusSinal }> = {
  dentro: { txt: 'Dentro da meta', status: 'bom' },
  atencao: { txt: 'Atenção', status: 'atencao' },
  acima: { txt: 'Acima da meta', status: 'ruim' },
  vazio: { txt: '—', status: 'neutro' },
};

interface Draft {
  alunos_segunda: number;
  matriculas: number;
  cancelamentos: number;
  alunos_sexta: number | null;
}

export function SemanalCard({
  semanas,
  metaEvasaoMensal,
  onSalvar,
}: {
  semanas: SemanaRow[];
  metaEvasaoMensal: number;
  onSalvar: (row: { semana_inicio: string } & Draft) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        semanas.map((s) => [
          s.semanaInicio,
          {
            alunos_segunda: s.alunosSegunda,
            matriculas: s.matriculas,
            cancelamentos: s.cancelamentos,
            alunos_sexta: s.preenchida ? s.alunosSexta : null,
          },
        ]),
      ),
    );
  }, [semanas]);

  const preenchidas = semanas.filter((s) => s.preenchida);
  const mediaTaxa = preenchidas.length
    ? preenchidas.reduce((a, s) => a + s.taxaSemana, 0) / preenchidas.length
    : 0;
  const mediaCresc = preenchidas.length
    ? preenchidas.reduce((a, s) => a + s.crescimentoLiquido, 0) / preenchidas.length
    : 0;

  const upd = (iso: string, key: keyof Draft, valor: number) =>
    setDrafts((d) => ({ ...d, [iso]: { ...d[iso], [key]: valor } }));

  const salvar = (iso: string) => {
    const d = drafts[iso];
    if (!d) return;
    onSalvar({ semana_inicio: iso, ...d });
  };

  return (
    <SectionCard
      title="Acompanhamento semanal"
      subtitle="Semana comercial de segunda a sexta. O fechamento ocorre toda sexta-feira."
      actions={<SinalBadge status="neutro">Meta de evasão mensal: {fmtPct(metaEvasaoMensal)}</SinalBadge>}
    >
      <p className="text-[11px] text-muted-foreground mb-3">
        A média móvel de 4 semanas é comparada com a meta mensal. Uma semana isolada não define a tendência.
      </p>
      <div className="overflow-x-auto -mx-2 px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Semana</TableHead>
              <TableHead className="text-xs">Alunos na segunda</TableHead>
              <TableHead className="text-xs">Matrículas</TableHead>
              <TableHead className="text-xs">Cancelamentos</TableHead>
              <TableHead className="text-xs text-right">Alunos na sexta</TableHead>
              <TableHead className="text-xs text-right">Cresc. líquido</TableHead>
              <TableHead className="text-xs text-right">Taxa da semana</TableHead>
              <TableHead className="text-xs text-right">Média móvel 4 sem.</TableHead>
              <TableHead className="text-xs text-right">Equiv. mensal</TableHead>
              <TableHead className="text-xs">Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {semanas.map((s) => {
              const d = drafts[s.semanaInicio];
              const sit = SITUACAO_LABEL[s.situacao];
              return (
                <TableRow key={s.semanaInicio}>
                  <TableCell className="text-xs whitespace-nowrap font-medium">{s.label}</TableCell>
                  {(['alunos_segunda', 'matriculas', 'cancelamentos'] as const).map((k) => (
                    <TableCell key={k}>
                      <Input
                        type="number"
                        className="h-8 w-[80px] text-xs"
                        value={d?.[k] ?? 0}
                        onChange={(e) => upd(s.semanaInicio, k, num(e.target.value))}
                        onBlur={() => salvar(s.semanaInicio)}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-xs text-right tabular-nums font-semibold">
                    {s.preenchida ? fmtInt(s.alunosSexta) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    {s.preenchida ? `${s.crescimentoLiquido > 0 ? '+' : ''}${fmtInt(Math.abs(s.crescimentoLiquido))}` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    {s.preenchida ? fmtPct(s.taxaSemana) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    {s.mediaMovel4 !== null ? fmtPct(s.mediaMovel4) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    {s.equivalenteMensal !== null ? fmtPct(s.equivalenteMensal) : '—'}
                  </TableCell>
                  <TableCell>
                    <SinalBadge status={sit.status}>{sit.txt}</SinalBadge>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell className="text-xs">MÉDIA DO PERÍODO</TableCell>
              <TableCell colSpan={4} />
              <TableCell className="text-xs text-right tabular-nums">
                {mediaCresc > 0 ? '+' : ''}
                {fmtInt(Math.abs(mediaCresc))}
              </TableCell>
              <TableCell className="text-xs text-right tabular-nums">{fmtPct(mediaTaxa)}</TableCell>
              <TableCell />
              <TableCell className="text-xs text-right tabular-nums">
                {fmtPct(1 - Math.pow(1 - mediaTaxa, 4.33))}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        Taxa de evasão semanal = cancelamentos da semana ÷ alunos na segunda. Equivalente mensal considera{' '}
        {safeDiv(52, 12).toFixed(2)} semanas por mês.
      </p>
    </SectionCard>
  );
}
