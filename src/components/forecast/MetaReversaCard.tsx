import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LinhaIndicador, SectionCard } from './ForecastUI';
import { MetaReversa, fmtInt, fmtMoeda0, num } from '@/lib/forecast';

export function MetaReversaCard({
  mr,
  meta,
  prazo,
  onMeta,
  onPrazo,
}: {
  mr: MetaReversa;
  meta: number;
  prazo: number;
  onMeta: (v: number) => void;
  onPrazo: (v: number) => void;
}) {
  return (
    <SectionCard
      title="Meta reversa"
      subtitle="O que precisamos gerar comercialmente, por mês, para chegar à meta."
      actions={
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Meta de alunos</Label>
            <Input
              type="number"
              className="h-8 w-24"
              value={Math.round(meta)}
              onChange={(e) => onMeta(num(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Prazo (meses)</Label>
            <Input
              type="number"
              className="h-8 w-20"
              value={Math.round(prazo)}
              onChange={(e) => onPrazo(Math.max(1, num(e.target.value)))}
            />
          </div>
        </div>
      }
    >
      <div className="grid md:grid-cols-2 gap-x-8">
        <div>
          <LinhaIndicador
            label={`Crescimento líquido necessário / mês`}
            value={fmtInt(mr.crescimentoNecessario)}
          />
          <LinhaIndicador label="Matrículas necessárias / mês" value={fmtInt(mr.matriculas)} />
          <LinhaIndicador label="Comparecimentos necessários / mês" value={fmtInt(mr.comparecimentos)} />
          <LinhaIndicador label="Experimentais necessárias / mês" value={fmtInt(mr.experimentais)} />
        </div>
        <div>
          <LinhaIndicador label="Leads necessários / mês" value={fmtInt(mr.leads)} />
          <LinhaIndicador label="Conversas necessárias / mês" value={fmtInt(mr.conversas)} />
          <LinhaIndicador label="Investimento necessário / mês" value={fmtMoeda0(mr.investimento)} />
          <LinhaIndicador
            label="Investimento adicional necessário"
            value={`${mr.investimentoAdicional > 0 ? '+' : ''}${fmtMoeda0(mr.investimentoAdicional)}`}
            status={mr.investimentoAdicional > 0 ? 'atencao' : 'bom'}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        Crescimento total necessário: {fmtInt(mr.crescimentoNecessarioTotal)} alunos em {mr.meses}{' '}
        {mr.meses === 1 ? 'mês' : 'meses'}.
      </p>
    </SectionCard>
  );
}
