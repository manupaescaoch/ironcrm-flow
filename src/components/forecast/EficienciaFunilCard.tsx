import { LinhaIndicador, SectionCard, TOOLTIPS } from './ForecastUI';
import {
  EficienciaFunil,
  Premissas,
  fmtInt,
  fmtMoeda,
  fmtPct,
  sinal,
} from '@/lib/forecast';

export interface MetasFunil {
  leadExp: number;
  comparecimento: number;
  expMat: number;
  cpl: number;
  cac: number;
  evasao: number;
}

export function EficienciaFunilCard({
  ef,
  metas,
  premissas,
}: {
  ef: EficienciaFunil;
  metas: MetasFunil;
  premissas: Premissas;
}) {
  return (
    <SectionCard
      title="Eficiência do funil"
      subtitle="Comparado às metas da unidade. Verde dentro da meta, amarelo atenção, vermelho abaixo."
    >
      <div className="space-y-0.5">
        <LinhaIndicador
          label="Custo por conversa"
          value={fmtMoeda(ef.custoPorConversa)}
          dica={TOOLTIPS.custoConversa}
        />
        <LinhaIndicador
          label="Aproveitamento do atendimento"
          value={fmtPct(ef.aproveitamentoAtendimento)}
          dica={TOOLTIPS.aproveitamento}
          status={sinal(ef.aproveitamentoAtendimento, premissas.aproveitamentoAtendimento)}
        />
        <LinhaIndicador
          label="CPL — lead no CRM"
          value={fmtMoeda(ef.cpl)}
          dica={TOOLTIPS.cpl}
          status={sinal(ef.cpl, metas.cpl, false)}
        />
        <LinhaIndicador
          label="Lead → Experimental"
          value={fmtPct(ef.leadExp)}
          dica={TOOLTIPS.leadExp}
          status={sinal(ef.leadExp, metas.leadExp)}
        />
        <LinhaIndicador
          label="Comparecimento"
          value={fmtPct(ef.comparecimento)}
          dica={TOOLTIPS.comparecimento}
          status={sinal(ef.comparecimento, metas.comparecimento)}
        />
        <LinhaIndicador
          label="Experimental → Matrícula"
          value={fmtPct(ef.expMat)}
          dica={TOOLTIPS.expMat}
          status={sinal(ef.expMat, metas.expMat)}
        />
        <LinhaIndicador
          label="CAC via tráfego"
          value={fmtMoeda(ef.cacTrafego)}
          dica={TOOLTIPS.cac}
          status={sinal(ef.cacTrafego, metas.cac, false)}
        />
        <LinhaIndicador label="Evasões do último mês" value={fmtInt(ef.evasoes)} />
        <LinhaIndicador
          label="Taxa de evasão"
          value={fmtPct(ef.evasaoPct)}
          dica={TOOLTIPS.evasao}
          status={sinal(ef.evasaoPct, metas.evasao, false)}
        />
        <LinhaIndicador
          label="Crescimento líquido"
          value={`${ef.crescimentoLiquido > 0 ? '+' : ''}${fmtInt(Math.abs(ef.crescimentoLiquido))}`}
          dica={TOOLTIPS.crescimento}
          status={ef.crescimentoLiquido > 0 ? 'bom' : ef.crescimentoLiquido === 0 ? 'atencao' : 'ruim'}
        />
      </div>
    </SectionCard>
  );
}
