import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PremissaRow } from '@/hooks/useForecast';
import type { ForecastPremissas } from '@/lib/forecast/calc';

interface Props {
  unidadeId: string | undefined;
  ano: number;
  mes: number;
  premissa: PremissaRow | undefined;
  valores: ForecastPremissas;
  podeEditar: boolean;
}

const pct = (v: number) => Math.round(v * 1000) / 10;

export function PremissasEditor({ unidadeId, ano, mes, premissa, valores, podeEditar }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    investimento_previsto: String(valores.investimentoPrevisto ?? 0),
    custo_por_conversa: valores.custoPorConversa != null ? String(valores.custoPorConversa) : '',
    taxa_conversa_lead: String(pct(valores.taxaConversaLead)),
    taxa_lead_agendamento: String(pct(valores.taxaLeadAgendamento)),
    taxa_agendamento_comparecimento: String(pct(valores.taxaAgendamentoComparecimento)),
    taxa_comparecimento_matricula: String(pct(valores.taxaComparecimentoMatricula)),
    churn_mensal: String(pct(valores.churnMensal)),
    ticket_medio: valores.ticketMedio != null ? String(valores.ticketMedio) : '',
    capacidade_maxima: valores.capacidadeMaxima != null ? String(valores.capacidadeMaxima) : '',
  }));

  const faltando = useMemo(() => {
    const itens: string[] = [];
    if (!premissa) itens.push('premissas do mês');
    if (valores.custoPorConversa == null) itens.push('custo por conversa');
    if (valores.capacidadeMaxima == null) itens.push('capacidade máxima');
    if (valores.ticketMedio == null) itens.push('ticket médio');
    return itens;
  }, [premissa, valores]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const parseTaxa = (v: string) => {
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n)) return 0;
    return Math.min(Math.max(n, 0), 100) / 100;
  };
  const parseNum = (v: string): number | null => {
    if (v.trim() === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const salvar = async () => {
    if (!unidadeId) return;
    setSaving(true);
    try {
      const payload = {
        unidade_id: unidadeId,
        ano,
        mes,
        investimento_previsto: parseNum(form.investimento_previsto) ?? 0,
        custo_por_conversa: parseNum(form.custo_por_conversa),
        taxa_conversa_lead: parseTaxa(form.taxa_conversa_lead),
        taxa_lead_agendamento: parseTaxa(form.taxa_lead_agendamento),
        taxa_agendamento_comparecimento: parseTaxa(form.taxa_agendamento_comparecimento),
        taxa_comparecimento_matricula: parseTaxa(form.taxa_comparecimento_matricula),
        churn_mensal: parseTaxa(form.churn_mensal),
        ticket_medio: parseNum(form.ticket_medio),
        capacidade_maxima: parseNum(form.capacidade_maxima),
      };

      const { error } = await (supabase as any)
        .from('forecast_premissas')
        .upsert(payload, { onConflict: 'unidade_id,ano,mes' });
      if (error) throw error;

      toast({ title: 'Premissas salvas', description: `Mês ${String(mes).padStart(2, '0')}/${ano} atualizado.` });
      queryClient.invalidateQueries({ queryKey: ['forecast-premissas'] });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Premissas do mês</CardTitle>
        {faltando.length > 0 && (
          <Badge variant="outline" className="text-xs">
            Faltando: {faltando.join(', ')}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!podeEditar && (
          <p className="text-sm text-muted-foreground">
            Somente administradores editam as premissas. Os valores abaixo são os cadastrados para este mês.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Investimento previsto (R$)</Label>
            <Input value={form.investimento_previsto} onChange={set('investimento_previsto')} disabled={!podeEditar} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label>Custo por conversa (R$)</Label>
            <Input value={form.custo_por_conversa} onChange={set('custo_por_conversa')} disabled={!podeEditar} inputMode="decimal" placeholder="—" />
          </div>
          <div className="space-y-1.5">
            <Label>Conversa → Lead (%)</Label>
            <Input value={form.taxa_conversa_lead} onChange={set('taxa_conversa_lead')} disabled={!podeEditar} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label>Lead → Agendamento (%)</Label>
            <Input value={form.taxa_lead_agendamento} onChange={set('taxa_lead_agendamento')} disabled={!podeEditar} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label>Agendamento → Comparecimento (%)</Label>
            <Input value={form.taxa_agendamento_comparecimento} onChange={set('taxa_agendamento_comparecimento')} disabled={!podeEditar} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label>Comparecimento → Matrícula (%)</Label>
            <Input value={form.taxa_comparecimento_matricula} onChange={set('taxa_comparecimento_matricula')} disabled={!podeEditar} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label>Churn mensal (%)</Label>
            <Input value={form.churn_mensal} onChange={set('churn_mensal')} disabled={!podeEditar} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label>Ticket médio (R$)</Label>
            <Input value={form.ticket_medio} onChange={set('ticket_medio')} disabled={!podeEditar} inputMode="decimal" placeholder="—" />
          </div>
          <div className="space-y-1.5">
            <Label>Capacidade máxima (alunos)</Label>
            <Input value={form.capacidade_maxima} onChange={set('capacidade_maxima')} disabled={!podeEditar} inputMode="numeric" placeholder="—" />
          </div>
        </div>
        {podeEditar && (
          <div className="flex justify-end">
            <Button onClick={salvar} disabled={saving || !unidadeId}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar premissas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
