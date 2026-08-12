import { AlertTriangle } from 'lucide-react';
import { LinhaIndicador, SectionCard, SinalBadge, TOOLTIPS } from './ForecastUI';
import { ForecastMes, Premissas, fmtInt, fmtMoeda0, fmtPct } from '@/lib/forecast';

export function ForecastProximoMesCard({
  f,
  premissas,
  label,
}: {
  f: ForecastMes;
  premissas: Premissas;
  label: string;
}) {
  return (
    <SectionCard
      title={`Forecast de ${label}`}
      subtitle="Projeção calculada a partir das premissas atuais."
      actions={
        premissas.metaAlunos <= 0 ? (
          <SinalBadge status="neutro">Defina a meta de alunos nas premissas</SinalBadge>
        ) : f.distanciaMeta <= 0 ? (
          <SinalBadge status="bom">Meta superada em {fmtInt(Math.abs(f.distanciaMeta))} alunos</SinalBadge>
        ) : (
          <SinalBadge status="atencao">Faltam {fmtInt(f.distanciaMeta)} alunos para a meta</SinalBadge>
        )
      }
    >
      {f.excedeCapacidade && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">
            <strong>CAPACIDADE PROJETADA EXCEDIDA.</strong> A projeção de {fmtInt(f.alunosAtivos)} alunos ultrapassa a
            capacidade de {fmtInt(premissas.capacidade)}. O número é mantido para demonstrar demanda reprimida.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Destaque label="Matrículas projetadas" value={fmtInt(f.matriculas)} />
        <Destaque label="Crescimento líquido" value={`${f.crescimentoLiquido > 0 ? '+' : ''}${fmtInt(Math.abs(f.crescimentoLiquido))}`} />
        <Destaque label="Alunos ativos projetados" value={fmtInt(f.alunosAtivos)} />
        <Destaque label="Receita projetada" value={fmtMoeda0(f.receita)} />
      </div>

      <div className="grid md:grid-cols-2 gap-x-8">
        <div>
          <LinhaIndicador label="Leads projetados" value={fmtInt(f.leads)} />
          <LinhaIndicador label="Experimentais marcadas" value={fmtInt(f.experimentais)} />
          <LinhaIndicador label="Comparecimentos" value={fmtInt(f.comparecimentos)} dica={TOOLTIPS.comparecimento} />
        </div>
        <div>
          <LinhaIndicador label="Evasões projetadas" value={fmtInt(f.evasoes)} dica={TOOLTIPS.evasao} />
          <LinhaIndicador label="CAC projetado" value={fmtMoeda0(f.cac)} dica={TOOLTIPS.cac} />
          <LinhaIndicador
            label="Ocupação projetada"
            value={fmtPct(f.ocupacao)}
            dica={TOOLTIPS.ocupacao}
            status={f.ocupacao >= 1 ? 'ruim' : f.ocupacao >= 0.9 ? 'atencao' : 'bom'}
          />
        </div>
      </div>
    </SectionCard>
  );
}

function Destaque({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-1">{value}</p>
    </div>
  );
}
