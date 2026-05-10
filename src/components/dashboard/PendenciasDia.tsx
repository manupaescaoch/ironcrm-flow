import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, ClipboardCheck, MessageCircleQuestion, FileWarning, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { format, addDays } from 'date-fns';

type Severity = 'warning' | 'critical';

interface PendenciaCounts {
  anamnesesPendentes: number;
  evoPendentes: number;
  followUpsSemRetorno: number;
  expSemStatus: number;
  lembretesFalha: number;
}

interface PendenciasDiaProps {
  onVerTodas?: () => void;
  onVerAnamneses?: () => void;
  onVerEvo?: () => void;
  onVerFollowUps?: () => void;
  onVerExperimentais?: () => void;
}

export function PendenciasDia({
  onVerTodas,
  onVerAnamneses,
  onVerEvo,
  onVerFollowUps,
  onVerExperimentais,
}: PendenciasDiaProps) {
  const { unidadeAtual } = useUnidade();
  const [counts, setCounts] = useState<PendenciaCounts>({
    anamnesesPendentes: 0,
    evoPendentes: 0,
    followUpsSemRetorno: 0,
    expSemStatus: 0,
    lembretesFalha: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!unidadeAtual) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      const [leadsExpRes, anamLeadsRes, evoRes, fuSemRetornoRes, expSemStatusRes] = await Promise.all([
        // Leads com experimental hoje ou amanhã
        supabase
          .from('leads')
          .select('id')
          .eq('unidade_id', unidadeAtual.id)
          .eq('ativo', true)
          .gte('data_aula_experimental', today)
          .lte('data_aula_experimental', tomorrow),
        // Leads que JÁ responderam a anamnese
        supabase
          .from('anamneses_experimental')
          .select('lead_id')
          .eq('unidade_id', unidadeAtual.id),
        // Agendamentos de amanhã não lançados no EVO
        supabase
          .from('interacoes')
          .select('id', { count: 'exact', head: true })
          .eq('unidade_id', unidadeAtual.id)
          .eq('agendou_experimental', true)
          .eq('data_experimental', tomorrow)
          .eq('agendado_evo', false),
        // Follow-ups enviados há mais de 24h sem mudança de status do lead
        supabase
          .from('leads')
          .select('id, status_funil, follow_up_whatsapp_enviado, follow_up_enviado_em')
          .eq('unidade_id', unidadeAtual.id)
          .eq('ativo', true)
          .eq('follow_up_whatsapp_enviado', true)
          .not('status_funil', 'in', '(convertido,perdido)')
          .lte('follow_up_enviado_em', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
        // Experimentais realizadas (compareceu) sem matrícula e lead ainda não convertido/perdido
        supabase
          .from('interacoes')
          .select('id, lead_id, leads!inner(status_funil, ativo, unidade_id)')
          .eq('unidade_id', unidadeAtual.id)
          .eq('compareceu', true)
          .eq('fechou_matricula', false)
          .lt('data_experimental', today),
      ]);

      const leadsComAnamnese = new Set((anamLeadsRes.data || []).map((a: any) => a.lead_id));
      const anamPendentes = (leadsExpRes.data || []).filter((l: any) => !leadsComAnamnese.has(l.id)).length;

      const expSemStatus = ((expSemStatusRes.data || []) as any[]).filter(
        (i) => i.leads && i.leads.ativo !== false && !['convertido', 'perdido', 'negociacao'].includes(i.leads.status_funil)
      ).length;

      if (cancelled) return;
      setCounts({
        anamnesesPendentes: anamPendentes,
        evoPendentes: evoRes.count ?? 0,
        followUpsSemRetorno: (fuSemRetornoRes.data || []).length,
        expSemStatus,
        lembretesFalha: 0,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [unidadeAtual]);

  const items: Array<{
    key: keyof PendenciaCounts;
    label: string;
    unit: string;
    subtitle: string;
    icon: typeof ClipboardList;
    severity: Severity;
    onView?: () => void;
  }> = [
    { key: 'anamnesesPendentes', label: 'Anamneses pendentes', unit: 'leads', subtitle: 'Leads com experimental hoje ou amanhã sem anamnese respondida.', icon: ClipboardList, severity: 'warning', onView: onVerAnamneses },
    { key: 'evoPendentes', label: 'Agendamentos não lançados no EVO', unit: 'agendamentos', subtitle: 'Agendamentos de amanhã ainda não confirmados como lançados no EVO.', icon: ClipboardCheck, severity: 'warning', onView: onVerEvo },
    { key: 'followUpsSemRetorno', label: 'Follow-ups sem retorno', unit: 'leads', subtitle: 'Leads que receberam follow-up e ainda não responderam.', icon: MessageCircleQuestion, severity: 'warning', onView: onVerFollowUps },
    { key: 'expSemStatus', label: 'Experimentais sem status comercial', unit: 'experimentais', subtitle: 'Aulas realizadas sem status comercial atualizado.', icon: FileWarning, severity: 'critical', onView: onVerExperimentais },
    { key: 'lembretesFalha', label: 'Lembretes com falha', unit: 'falhas', subtitle: 'Falha no envio automático de lembrete.', icon: AlertTriangle, severity: 'critical' },
  ];

  const visibleItems = items.filter((i) => counts[i.key] > 0);
  const total = visibleItems.reduce((acc, i) => acc + counts[i.key], 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Pendências do Dia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShieldCheck className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma pendência para hoje.</p>
          </div>
        ) : (
          <>
            {visibleItems.map(({ key, label, unit, subtitle, icon: Icon, severity, onView }) => {
              const value = counts[key];
              const tone = severity === 'critical'
                ? 'border-destructive/30 bg-destructive/5'
                : 'border-amber-500/30 bg-amber-500/5';
              const iconColor = severity === 'critical' ? 'text-destructive' : 'text-amber-600';
              return (
                <div key={key} className={`flex items-start justify-between gap-3 rounded-md border ${tone} px-3 py-2`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-baseline gap-1.5 flex-wrap">
                        <span className="truncate">{label}:</span>
                        <span className={`tabular-nums font-semibold ${iconColor}`}>{value} {unit}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
                    </div>
                  </div>
                  {onView && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={onView}>
                      Ver
                    </Button>
                  )}
                </div>
              );
            })}
            {onVerTodas && (
              <div className="pt-2">
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={onVerTodas}>
                  Ver todas as pendências
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
