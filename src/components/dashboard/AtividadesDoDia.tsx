import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dumbbell, ClipboardCheck, ClipboardList, Send, CalendarClock, ArrowRight, BellRing, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface AtividadesStats {
  experimentaisHoje: number;
  confirmacoesEnviadas: number;
  anamnesesRespondidas: number;
  anamnesesPendentes: number;
  followUpsEnviados: number;
  followUpsAgendados: number;
}

type StatKey = keyof AtividadesStats;

interface LeadEntry {
  id: string;
  nome: string;
  detalhe?: string;
}

interface AtividadesDoDiaProps {
  onVerRelatorio?: () => void;
}

const ITEMS: Array<{ key: StatKey; label: string; subtitle: string; icon: any; color: string }> = [
  { key: 'experimentaisHoje', label: 'Experimentais do dia', subtitle: 'aulas experimentais hoje', icon: Dumbbell, color: 'text-primary' },
  { key: 'confirmacoesEnviadas', label: 'Confirmações experimentais', subtitle: 'lembretes 24h/2h enviados hoje', icon: BellRing, color: 'text-sky-600' },
  { key: 'anamnesesRespondidas', label: 'Anamneses respondidas', subtitle: 'respondidas hoje', icon: ClipboardCheck, color: 'text-green-600' },
  { key: 'anamnesesPendentes', label: 'Anamneses pendentes', subtitle: 'aguardando resposta', icon: ClipboardList, color: 'text-amber-600' },
  { key: 'followUpsEnviados', label: 'Follow-ups enviados', subtitle: 'enviados hoje', icon: Send, color: 'text-blue-600' },
  { key: 'followUpsAgendados', label: 'Follow-ups agendados', subtitle: 'programados', icon: CalendarClock, color: 'text-muted-foreground' },
];

export function AtividadesDoDia({ onVerRelatorio }: AtividadesDoDiaProps) {
  const { unidadeAtual } = useUnidade();
  const [stats, setStats] = useState<AtividadesStats>({
    experimentaisHoje: 0,
    confirmacoesEnviadas: 0,
    anamnesesRespondidas: 0,
    anamnesesPendentes: 0,
    followUpsEnviados: 0,
    followUpsAgendados: 0,
  });
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<StatKey | null>(null);
  const [modalLeads, setModalLeads] = useState<LeadEntry[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (!unidadeAtual) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const startTs = `${today}T00:00:00`;
      const endTs = `${today}T23:59:59`;

      const [expRes, anamRespRes, leadsExpRes, anamLeadIdsRes, fuEnvRes, fuAgRes, conf24Res, conf2Res] = await Promise.all([
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
        supabase
          .from('leads')
          .select('id')
          .eq('unidade_id', unidadeAtual.id)
          .gte('confirmacao_24h_enviada_em', startTs)
          .lte('confirmacao_24h_enviada_em', endTs),
        supabase
          .from('leads')
          .select('id')
          .eq('unidade_id', unidadeAtual.id)
          .gte('confirmacao_2h_enviada_em', startTs)
          .lte('confirmacao_2h_enviada_em', endTs),
      ]);

      const leadsComAnamnese = new Set((anamLeadIdsRes.data || []).map((a: any) => a.lead_id));
      const pendentes = (leadsExpRes.data || []).filter((l: any) => !leadsComAnamnese.has(l.id)).length;

      const confSet = new Set<string>();
      (conf24Res.data || []).forEach((l: any) => confSet.add(l.id));
      (conf2Res.data || []).forEach((l: any) => confSet.add(l.id));

      if (cancelled) return;
      setStats({
        experimentaisHoje: expRes.count ?? 0,
        confirmacoesEnviadas: confSet.size,
        anamnesesRespondidas: anamRespRes.count ?? 0,
        anamnesesPendentes: pendentes,
        followUpsEnviados: fuEnvRes.count ?? 0,
        followUpsAgendados: fuAgRes.count ?? 0,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [unidadeAtual]);

  const fetchLeadsForKey = async (key: StatKey) => {
    if (!unidadeAtual) return;
    setModalLoading(true);
    setModalLeads([]);
    const today = format(new Date(), 'yyyy-MM-dd');
    const startTs = `${today}T00:00:00`;
    const endTs = `${today}T23:59:59`;

    try {
      if (key === 'experimentaisHoje') {
        const { data } = await supabase
          .from('interacoes')
          .select('lead_id, hora_experimental, leads!inner(id, nome, ativo)')
          .eq('unidade_id', unidadeAtual.id)
          .eq('agendou_experimental', true)
          .eq('data_experimental', today);
        const list: LeadEntry[] = (data || [])
          .filter((r: any) => r.leads && r.leads.ativo !== false)
          .map((r: any) => ({
            id: r.leads.id,
            nome: r.leads.nome,
            detalhe: r.hora_experimental ? r.hora_experimental.slice(0, 5) : undefined,
          }));
        setModalLeads(dedupe(list));
      } else if (key === 'confirmacoesEnviadas') {
        const { data } = await supabase
          .from('leads')
          .select('id, nome, confirmacao_24h_enviada_em, confirmacao_2h_enviada_em')
          .eq('unidade_id', unidadeAtual.id)
          .or(`and(confirmacao_24h_enviada_em.gte.${startTs},confirmacao_24h_enviada_em.lte.${endTs}),and(confirmacao_2h_enviada_em.gte.${startTs},confirmacao_2h_enviada_em.lte.${endTs})`);
        const list: LeadEntry[] = (data || []).map((l: any) => {
          const at2h = l.confirmacao_2h_enviada_em && l.confirmacao_2h_enviada_em >= startTs && l.confirmacao_2h_enviada_em <= endTs;
          const tipo = at2h ? '2h' : '24h';
          const at = at2h ? l.confirmacao_2h_enviada_em : l.confirmacao_24h_enviada_em;
          return {
            id: l.id,
            nome: l.nome,
            detalhe: `${tipo} • ${format(new Date(at), 'HH:mm', { locale: ptBR })}`,
          };
        });
        setModalLeads(list);
      } else if (key === 'anamnesesRespondidas') {
        const { data } = await supabase
          .from('anamneses_experimental')
          .select('lead_id, created_at, leads!inner(id, nome)')
          .eq('unidade_id', unidadeAtual.id)
          .gte('created_at', startTs)
          .lte('created_at', endTs);
        const list: LeadEntry[] = (data || []).map((a: any) => ({
          id: a.leads.id,
          nome: a.leads.nome,
          detalhe: format(new Date(a.created_at), 'HH:mm', { locale: ptBR }),
        }));
        setModalLeads(list);
      } else if (key === 'anamnesesPendentes') {
        const [leadsRes, anamRes] = await Promise.all([
          supabase
            .from('leads')
            .select('id, nome, data_aula_experimental')
            .eq('unidade_id', unidadeAtual.id)
            .eq('ativo', true)
            .gte('data_aula_experimental', today),
          supabase
            .from('anamneses_experimental')
            .select('lead_id')
            .eq('unidade_id', unidadeAtual.id),
        ]);
        const respondidos = new Set((anamRes.data || []).map((a: any) => a.lead_id));
        const list: LeadEntry[] = (leadsRes.data || [])
          .filter((l: any) => !respondidos.has(l.id))
          .map((l: any) => ({
            id: l.id,
            nome: l.nome,
            detalhe: l.data_aula_experimental
              ? format(new Date(l.data_aula_experimental), 'dd/MM', { locale: ptBR })
              : undefined,
          }));
        setModalLeads(list);
      } else if (key === 'followUpsEnviados') {
        const { data } = await supabase
          .from('follow_ups')
          .select('lead_id, tipo, concluido_em, leads!inner(id, nome)')
          .eq('unidade_id', unidadeAtual.id)
          .eq('status', 'concluido')
          .gte('concluido_em', startTs)
          .lte('concluido_em', endTs);
        const list: LeadEntry[] = (data || []).map((f: any) => ({
          id: f.leads.id,
          nome: f.leads.nome,
          detalhe: `${f.tipo}${f.concluido_em ? ' • ' + format(new Date(f.concluido_em), 'HH:mm', { locale: ptBR }) : ''}`,
        }));
        setModalLeads(list);
      } else if (key === 'followUpsAgendados') {
        const { data } = await supabase
          .from('follow_ups')
          .select('lead_id, tipo, data_prevista, leads!inner(id, nome)')
          .eq('unidade_id', unidadeAtual.id)
          .eq('status', 'pendente')
          .gte('data_prevista', startTs)
          .order('data_prevista', { ascending: true });
        const list: LeadEntry[] = (data || []).map((f: any) => ({
          id: f.leads.id,
          nome: f.leads.nome,
          detalhe: `${f.tipo} • ${format(new Date(f.data_prevista), 'dd/MM HH:mm', { locale: ptBR })}`,
        }));
        setModalLeads(list);
      }
    } finally {
      setModalLoading(false);
    }
  };

  const dedupe = (list: LeadEntry[]) => {
    const seen = new Set<string>();
    return list.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  };

  const handleOpen = (key: StatKey) => {
    setOpenKey(key);
    fetchLeadsForKey(key);
  };

  const currentItem = ITEMS.find((i) => i.key === openKey);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Atividades do Dia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ITEMS.map(({ key, label, subtitle, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => handleOpen(key)}
              className="w-full flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{label}</div>
                  <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                </div>
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {loading ? '—' : stats[key]}
              </div>
            </button>
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

      <Dialog open={!!openKey} onOpenChange={(o) => !o && setOpenKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentItem && <currentItem.icon className={`h-4 w-4 ${currentItem.color}`} />}
              {currentItem?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-1">
            {modalLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando…</p>
            ) : modalLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead encontrado.</p>
            ) : (
              modalLeads.map((l, idx) => (
                <Link
                  key={`${l.id}-${idx}`}
                  to={`/lead/${l.id}`}
                  onClick={() => setOpenKey(null)}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{l.nome?.toUpperCase()}</div>
                    {l.detalhe && <div className="text-xs text-muted-foreground truncate">{l.detalhe}</div>}
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Link>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
