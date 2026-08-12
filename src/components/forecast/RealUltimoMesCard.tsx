import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Lock, Save, Unlock } from 'lucide-react';
import { LinhaIndicador, SectionCard, TOOLTIPS } from './ForecastUI';
import { RealMes, fmtInt, fmtMoeda, fmtMoeda0, fmtPct, num } from '@/lib/forecast';

export interface ManualRealValores {
  conversas: number;
  investimento: number;
  baseInicial: number;
  cancelamentos: number;
  alunosAtivos: number;
}

export function RealUltimoMesCard({
  real,
  label,
  fechado,
  onSalvar,
  onFechar,
  onReabrir,
  salvando,
}: {
  real: RealMes;
  label: string;
  fechado: boolean;
  onSalvar: (v: ManualRealValores) => void;
  onFechar: (v: ManualRealValores) => void;
  onReabrir: () => void;
  salvando: boolean;
}) {
  const [form, setForm] = useState<ManualRealValores>({
    conversas: real.conversas,
    investimento: real.investimento,
    baseInicial: real.baseInicial,
    cancelamentos: real.cancelamentos,
    alunosAtivos: real.alunosAtivos,
  });

  useEffect(() => {
    setForm({
      conversas: real.conversas,
      investimento: real.investimento,
      baseInicial: real.baseInicial,
      cancelamentos: real.cancelamentos,
      alunosAtivos: real.alunosAtivos,
    });
  }, [real.ano, real.mes, real.conversas, real.investimento, real.baseInicial, real.cancelamentos, real.alunosAtivos]);

  const set = (k: keyof ManualRealValores) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: num(e.target.value) }));

  const receitaNovas = real.matriculas * real.ticketMedio;
  const crescimento = real.matriculas - Math.min(real.cancelamentos, real.baseInicial || real.alunosAtivos);

  return (
    <SectionCard
      title={`Real de ${label}`}
      subtitle="Aquisição, financeiro e base do mês. Campos automáticos vêm do CRM."
      actions={
        fechado ? (
          <>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <Lock className="w-3 h-3 mr-1" /> Mês fechado
            </Badge>
            <Button size="sm" variant="outline" onClick={onReabrir}>
              <Unlock className="w-3.5 h-3.5 mr-1.5" /> Reabrir
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" disabled={salvando} onClick={() => onSalvar(form)}>
              <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar
            </Button>
            <Button size="sm" disabled={salvando} onClick={() => onFechar(form)}>
              <Lock className="w-3.5 h-3.5 mr-1.5" /> Fechar mês
            </Button>
          </>
        )
      }
    >
      <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Aquisição</p>
          <LinhaIndicador label="Investimento em tráfego" value={fmtMoeda(real.investimento)} fonte="manual" />
          <LinhaIndicador label="Conversas iniciadas" value={fmtInt(real.conversas)} fonte="manual" />
          <LinhaIndicador label="Leads cadastrados no CRM" value={fmtInt(real.leads)} fonte="auto" />
          <LinhaIndicador label="Experimentais marcadas" value={fmtInt(real.experimentais)} fonte="auto" />
          <LinhaIndicador label="Comparecimentos" value={fmtInt(real.comparecimentos)} fonte="auto" dica={TOOLTIPS.comparecimento} />
          <LinhaIndicador label="Matrículas totais do mês" value={fmtInt(real.matriculas)} fonte="auto" />
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Financeiro</p>
          <LinhaIndicador label="Ticket médio do mês" value={fmtMoeda(real.ticketMedio)} fonte="auto" />
          <LinhaIndicador label="Receita das novas matrículas" value={fmtMoeda0(receitaNovas)} fonte="auto" />

          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-4">Base</p>
          <LinhaIndicador label="Base no início do mês" value={fmtInt(real.baseInicial)} fonte="manual" />
          <LinhaIndicador label="Evasões do mês" value={fmtInt(real.cancelamentos)} fonte="manual" dica={TOOLTIPS.evasao} />
          <LinhaIndicador
            label="Crescimento líquido real"
            value={`${crescimento > 0 ? '+' : ''}${fmtInt(Math.abs(crescimento))}`}
            dica={TOOLTIPS.crescimento}
            status={crescimento > 0 ? 'bom' : crescimento === 0 ? 'atencao' : 'ruim'}
          />
          <LinhaIndicador label="Alunos ativos no fechamento" value={fmtInt(real.alunosAtivos)} fonte="manual" />
          <LinhaIndicador label="Taxa de evasão" value={fmtPct(real.evasaoPct)} dica={TOOLTIPS.evasao} />
        </div>
      </div>

      {!fechado && (
        <div className="mt-5 pt-4 border-t border-border/50">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Lançamentos manuais
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Investimento (R$)</Label>
              <Input type="number" step="0.01" value={form.investimento} onChange={set('investimento')} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Conversas iniciadas</Label>
              <Input type="number" value={form.conversas} onChange={set('conversas')} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Base inicial</Label>
              <Input type="number" value={form.baseInicial} onChange={set('baseInicial')} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Evasões (cancelamentos)</Label>
              <Input type="number" value={form.cancelamentos} onChange={set('cancelamentos')} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Alunos ativos no fim</Label>
              <Input type="number" value={form.alunosAtivos} onChange={set('alunosAtivos')} />
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
