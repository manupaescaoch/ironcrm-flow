import { KpiCard, TOOLTIPS } from './ForecastUI';
import {
  EficienciaFunil,
  Premissas,
  RealMes,
  fmtInt,
  fmtMoeda0,
  fmtPct,
  safeDiv,
  sinal,
} from '@/lib/forecast';

export function ForecastKPIs({
  premissas,
  real,
  ef,
}: {
  premissas: Premissas;
  real: RealMes;
  ef: EficienciaFunil;
}) {
  const ocupacao = safeDiv(premissas.baseInicial, premissas.capacidade);
  const receita = premissas.baseInicial * premissas.mensalidade;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <KpiCard label="Alunos ativos" value={fmtInt(premissas.baseInicial)} dica={TOOLTIPS.base} />
      <KpiCard
        label="Meta de alunos"
        value={fmtInt(premissas.metaAlunos)}
        hint={`Faltam ${fmtInt(Math.max(0, premissas.metaAlunos - premissas.baseInicial))} alunos`}
      />
      <KpiCard label="Capacidade máxima" value={fmtInt(premissas.capacidade)} />
      <KpiCard
        label="Ocupação atual"
        value={fmtPct(ocupacao)}
        dica={TOOLTIPS.ocupacao}
        status={ocupacao >= 0.9 ? 'ruim' : ocupacao >= 0.8 ? 'atencao' : 'bom'}
      />
      <KpiCard
        label="Cresc. líquido último mês"
        value={`${ef.crescimentoLiquido > 0 ? '+' : ''}${fmtInt(Math.abs(ef.crescimentoLiquido))}`}
        dica={TOOLTIPS.crescimento}
        status={ef.crescimentoLiquido > 0 ? 'bom' : ef.crescimentoLiquido === 0 ? 'atencao' : 'ruim'}
      />
      <KpiCard label="Matrículas último mês" value={fmtInt(real.matriculas)} />
      <KpiCard
        label="Taxa de evasão"
        value={fmtPct(ef.evasaoPct)}
        dica={TOOLTIPS.evasao}
        status={sinal(ef.evasaoPct, premissas.evasao || 0.05, false)}
      />
      <KpiCard label="CAC" value={fmtMoeda0(ef.cacTrafego)} dica={TOOLTIPS.cac} />
      <KpiCard
        label="Receita recorrente estimada"
        value={fmtMoeda0(receita)}
        dica={TOOLTIPS.receita}
        hint={`${fmtInt(premissas.baseInicial)} × ${fmtMoeda0(premissas.mensalidade)}`}
      />
    </div>
  );
}
