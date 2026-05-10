import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dumbbell, ClipboardCheck, ClipboardList, Send, CalendarClock, ArrowRight, BellRing } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { format } from 'date-fns';

interface AtividadesStats {
  experimentaisHoje: number;
  confirmacoesEnviadas: number;
  anamnesesRespondidas: number;
  anamnesesPendentes: number;
  followUpsEnviados: number;
  followUpsAgendados: number;
}

interface AtividadesDoDiaProps {
  onVerRelatorio?: () => void;
}

const ITEMS = [
  { key: 'experimentaisHoje', label: 'Experimentais do dia', subtitle: 'aulas experimentais hoje', icon: Dumbbell, color: 'text-primary' },
  { key: 'confirmacoesEnviadas', label: 'Confirmações experimentais', subtitle: 'lembretes 24h/2h enviados hoje', icon: BellRing, color: 'text-sky-600' },
  { key: 'anamnesesRespondidas', label: 'Anamneses respondidas', subtitle: 'respondidas hoje', icon: ClipboardCheck, color: 'text-green-600' },
  { key: 'anamnesesPendentes', label: 'Anamneses pendentes', subtitle: 'aguardando resposta', icon: ClipboardList, color: 'text-amber-600' },
  { key: 'followUpsEnviados', label: 'Follow-ups enviados', subtitle: 'enviados hoje', icon: Send, color: 'text-blue-600' },
  { key: 'followUpsAgendados', label: 'Follow-ups agendados', subtitle: 'programados', icon: CalendarClock, color: 'text-muted-foreground' },
] as const;

export function AtividadesDoDia({ onVerRelatorio }: AtividadesDoDiaProps) {
  const { unidadeAtual } = useUnidade();
  const [stats, setStats] = useState<AtividadesStats>({
    experimentaisHoje: 0,
    anamnesesRespondidas: 0,
    anamnesesPendentes: 0,
    followUpsEnviados: 0,
    followUpsAgendados: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!unidadeAtual) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const startTs = `${today}T00:00:00`;
      const endTs = `${today}T23:59:59`;

      const [expRes, anamRespRes, leadsExpRes, anamLeadIdsRes, fuEnvRes, fuAgRes] = await Promise.all([
        supabase
          .from('interacoes')
          .select('lead_id', { count: 'exact', head: true })
          .eq('unidade_id', unidadeAtual.id)
          .eq('agendou_experimental', true)
          .eq('data_experimental', today),
        supabase
          .from('anamneses_experimental')
          .select('id', { count: 'exact', head: true })
          .eq('unidade_id', unidadeAtual.id)
          .gte('created_at', startTs)
          .lte('created_at', endTs),
        supabase
          .from('leads')
          .select('id')
          .eq('unidade_id', unidadeAtual.id)
          .eq('ativo', true)
          .gte('data_aula_experimental', today),
        supabase
          .from('anamneses_experimental')
          .select('lead_id')
          .eq('unidade_id', unidadeAtual.id),
        supabase
          .from('follow_ups')
          .select('id', { count: 'exact', head: true })
          .eq('unidade_id', unidadeAtual.id)
          .eq('status', 'concluido')
          .gte('concluido_em', startTs)
          .lte('concluido_em', endTs),
        supabase
          .from('follow_ups')
          .select('id', { count: 'exact', head: true })
          .eq('unidade_id', unidadeAtual.id)
          .eq('status', 'pendente')
          .gte('data_prevista', startTs),
      ]);

      const leadsComAnamnese = new Set((anamLeadIdsRes.data || []).map((a: any) => a.lead_id));
      const pendentes = (leadsExpRes.data || []).filter((l: any) => !leadsComAnamnese.has(l.id)).length;

      if (cancelled) return;
      setStats({
        experimentaisHoje: expRes.count ?? 0,
        anamnesesRespondidas: anamRespRes.count ?? 0,
        anamnesesPendentes: pendentes,
        followUpsEnviados: fuEnvRes.count ?? 0,
        followUpsAgendados: fuAgRes.count ?? 0,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [unidadeAtual]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Atividades do Dia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ITEMS.map(({ key, label, subtitle, icon: Icon, color }) => (
          <div key={key} className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <Icon className={`h-4 w-4 shrink-0 ${color}`} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{label}</div>
                <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
              </div>
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {loading ? '—' : stats[key as keyof AtividadesStats]}
            </div>
          </div>
        ))}
        {onVerRelatorio && (
          <div className="pt-2">
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={onVerRelatorio}>
              Ver relatório completo
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
