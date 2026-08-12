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
import { SectionCard } from './ForecastUI';
import {
  CenarioInput,
  Premissas,
  calcCenario,
  fmtInt,
  fmtMoeda0,
  num,
} from '@/lib/forecast';

function cenariosIniciais(p: Premissas): CenarioInput[] {
  const meta = p.metaAlunos || p.baseInicial;
  return [
    {
      nome: 'Conservador',
      metaAlunos: Math.round(meta * 0.9),
      prazo: 12,
      cpl: p.cpl * 1.15,
      leadExp: p.leadExp * 0.9,
      comparecimento: p.comparecimento * 0.9,
      expMat: p.expMat * 0.9,
      evasao: p.evasao * 1.15,
    },
    {
      nome: 'Base',
      metaAlunos: Math.round(meta),
      prazo: 12,
      cpl: p.cpl,
      leadExp: p.leadExp,
      comparecimento: p.comparecimento,
      expMat: p.expMat,
      evasao: p.evasao,
    },
    {
      nome: 'Agressivo',
      metaAlunos: Math.round(Math.max(meta * 1.15, meta + 20)),
      prazo: 9,
      cpl: p.cpl * 0.9,
      leadExp: Math.min(1, p.leadExp * 1.1),
      comparecimento: Math.min(1, p.comparecimento * 1.1),
      expMat: Math.min(1, p.expMat * 1.05),
      evasao: Math.max(0, p.evasao * 0.85),
    },
  ];
}

export function CenariosCard({ premissas }: { premissas: Premissas }) {
  const [cenarios, setCenarios] = useState<CenarioInput[]>(() => cenariosIniciais(premissas));

  useEffect(() => {
    setCenarios(cenariosIniciais(premissas));
  }, [premissas.cpl, premissas.leadExp, premissas.comparecimento, premissas.expMat, premissas.evasao, premissas.metaAlunos, premissas.baseInicial]);

  const set = (idx: number, key: keyof CenarioInput, valor: number) =>
    setCenarios((cs) => cs.map((c, i) => (i === idx ? { ...c, [key]: valor } : c)));

  const pctInput = (idx: number, key: 'leadExp' | 'comparecimento' | 'expMat' | 'evasao') => (
    <Input
      type="number"
      step="0.1"
      className="h-8 w-[70px] text-xs"
      value={Number((cenarios[idx][key] * 100).toFixed(1))}
      onChange={(e) => set(idx, key, num(e.target.value) / 100)}
    />
  );

  return (
    <SectionCard
      title="Cenários de meta"
      subtitle="Tudo calculado com as premissas atuais. Altere meta, prazo, CPL, conversões ou evasão para ver o impacto imediato."
    >
      <div className="overflow-x-auto -mx-2 px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Cenário</TableHead>
              <TableHead className="text-xs">Meta</TableHead>
              <TableHead className="text-xs">Prazo</TableHead>
              <TableHead className="text-xs">CPL</TableHead>
              <TableHead className="text-xs">Lead→Exp</TableHead>
              <TableHead className="text-xs">Compar.</TableHead>
              <TableHead className="text-xs">Exp→Mat</TableHead>
              <TableHead className="text-xs">Evasão</TableHead>
              <TableHead className="text-xs text-right">Matríc./mês</TableHead>
              <TableHead className="text-xs text-right">Leads/mês</TableHead>
              <TableHead className="text-xs text-right">Invest./mês</TableHead>
              <TableHead className="text-xs text-right">CAC</TableHead>
              <TableHead className="text-xs text-right">Receita na meta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cenarios.map((c, idx) => {
              const r = calcCenario(premissas, c);
              return (
                <TableRow key={c.nome}>
                  <TableCell className="text-xs font-semibold whitespace-nowrap">{c.nome}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="h-8 w-[80px] text-xs"
                      value={Math.round(c.metaAlunos)}
                      onChange={(e) => set(idx, 'metaAlunos', num(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="h-8 w-[64px] text-xs"
                      value={Math.round(c.prazo)}
                      onChange={(e) => set(idx, 'prazo', Math.max(1, num(e.target.value)))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 w-[84px] text-xs"
                      value={Number(c.cpl.toFixed(2))}
                      onChange={(e) => set(idx, 'cpl', num(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>{pctInput(idx, 'leadExp')}</TableCell>
                  <TableCell>{pctInput(idx, 'comparecimento')}</TableCell>
                  <TableCell>{pctInput(idx, 'expMat')}</TableCell>
                  <TableCell>{pctInput(idx, 'evasao')}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-semibold">{fmtInt(r.matriculasMes)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmtInt(r.leadsMes)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-semibold">{fmtMoeda0(r.investimentoMes)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmtMoeda0(r.cac)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmtMoeda0(r.receitaNaMeta)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
