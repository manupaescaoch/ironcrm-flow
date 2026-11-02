import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Bell,
  Clock,
  MessageCircle,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Bot,
  User as UserIcon,
  Loader2,
} from 'lucide-react';

interface Props {
  leadId: string;
  lead: {
    confirmacao_24h_enviada_em?: string | null;
    confirmacao_2h_enviada_em?: string | null;
    follow_up_enviado_em?: string | null;
    follow_up_responsavel?: string | null;
    follow_up_whatsapp_enviado?: boolean | null;
  } | null;
}

interface TimelineEvent {
  id: string;
  data: Date;
  tipo: string;
  status: string;
  responsavel: string;
  isAuto: boolean;
  motivo?: string | null;
}

const TIPO_LABELS: Record<string, string> = {
  'D+1': 'Follow-up D+1 (pós-experimental)',
  'D+7': 'Follow-up D+7',
  'D+15': 'Follow-up D+15',
  'D+30': 'Follow-up D+30',
  'M+7': 'Follow-up Pós-matrícula (M+7)',
  'M+30': 'Follow-up Pós-matrícula (M+30)',
  'REAG': 'FU Reagendamento (não compareceu)',
};

const STATUS_STYLE: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  concluido: { label: 'Concluído', cls: 'border-green-500 text-green-700 bg-green-50', Icon: CheckCircle2 },
  pendente: { label: 'Pendente', cls: 'border-amber-500 text-amber-700 bg-amber-50', Icon: Clock },
  cancelado: { label: 'Cancelado', cls: 'border-red-500 text-red-700 bg-red-50', Icon: XCircle },
  enviado: { label: 'Enviado', cls: 'border-blue-500 text-blue-700 bg-blue-50', Icon: CheckCircle2 },
  em_andamento: { label: 'Em andamento', cls: 'border-primary text-primary bg-primary/10', Icon: Clock },
  dispensado: { label: 'Dispensado', cls: 'border-border text-muted-foreground bg-muted', Icon: XCircle },
};

function isAutoResponsavel(nome: string | null | undefined) {
  if (!nome) return true;
  const n = nome.toUpperCase();
  return n.includes('SISTEMA') || n.includes('AUTOMÁTICO') || n.includes('AUTOMATICO');
}

export function FollowUpHistoryTimeline({ leadId, lead }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: fus } = await supabase
        .from('follow_ups')
        .select('id, tipo, status, data_prevista, concluido_em, concluido_por, created_at, cancelado_motivo, updated_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      const list: TimelineEvent[] = [];
      const { data: matriculados } = await supabase.from('tasks')
        .select('id,status,created_at,fu_matriculados_confirmado_em,fu_matriculados_confirmado_nome,fu_matriculados_envio_erro')
        .eq('fu_matriculados_lead_id', leadId).order('created_at');
      for (const t of matriculados ?? []) {
        list.push({ id:`${t.id}-matricula`,data:new Date(t.created_at),tipo:'FU Matriculados — boas-vindas Comercial',status:t.status === 'concluida' ? 'concluido' : 'pendente',responsavel:'Sistema',isAuto:true,motivo:t.fu_matriculados_envio_erro });
        if(t.fu_matriculados_confirmado_em) list.push({id:`${t.id}-envio-matriculados`,data:new Date(t.fu_matriculados_confirmado_em),tipo:'Envio manual confirmado — FU Matriculados',status:'enviado',responsavel:t.fu_matriculados_confirmado_nome ?? 'Comercial',isAuto:false,motivo:'Confirmação manual; acompanhamento separado'});
      }
      const { data: gerenciais } = await supabase.from('tasks')
        .select('id,fu_gerencial_status,fu_gerencial_registro,updated_at,responsavel,fu_gerencial_envio_erro,fu_gerencial_confirmado_em,fu_gerencial_confirmado_nome,fu_gerencial_concluido_em')
        .eq('fu_gerencial_lead_id',leadId).order('created_at');
      for (const t of gerenciais ?? []) {
        if (t.fu_gerencial_confirmado_em) list.push({ id:`${t.id}-envio-gerencial`,data:new Date(t.fu_gerencial_confirmado_em),tipo:'Envio manual confirmado — FU gerencial M+30',status:'enviado',responsavel:t.fu_gerencial_confirmado_nome ?? 'Gerente',isAuto:false,motivo:'Confirmação manual; acompanhamento separado' });
        const r = t.fu_gerencial_registro as { data?:string; gerente?:string; canal?:string; percepcao?:string; reclamacoes?:string; melhorias?:string; providencias?:string } | null;
        const day = r?.data ? (() => {const [a,m,d]=r.data.split('-').map(Number);return new Date(a,m-1,d);})() : new Date(t.updated_at);
        list.push({id:t.id,data:t.fu_gerencial_concluido_em ? new Date(t.fu_gerencial_concluido_em) : day,tipo:'Acompanhamento gerencial M+30',status:t.fu_gerencial_status ?? 'pendente',responsavel:r?.gerente ?? t.responsavel,isAuto:!r,motivo:r ? [r.canal,r.percepcao,r.reclamacoes,r.melhorias,r.providencias].filter(Boolean).join(' · ') : t.fu_gerencial_envio_erro});
      }
      const { data: tecnicos } = await supabase.from('tasks')
        .select('id,fu_tecnico_etapa,fu_tecnico_status,fu_tecnico_registro,updated_at,responsavel,fu_tecnico_envio_erro,fu_tecnico_confirmado_em,fu_tecnico_confirmado_nome,fu_tecnico_confirmado_telegram_id')
        .eq('fu_tecnico_lead_id', leadId).order('created_at');
      for (const t of tecnicos ?? []) {
        if (t.fu_tecnico_confirmado_em) list.push({ id: `${t.id}-envio`, data: new Date(t.fu_tecnico_confirmado_em),
          tipo: `Envio manual confirmado — FU técnico ${t.fu_tecnico_etapa}`, status: 'enviado', responsavel: t.fu_tecnico_confirmado_nome ?? 'Coordenador', isAuto: false,
          motivo: `Telegram: ${t.fu_tecnico_confirmado_telegram_id} · Confirmação manual; acompanhamento separado` });
        const registro = t.fu_tecnico_registro as { data?: string; coordenador?: string; canal?: string; observacoes?: string; dificuldades?: string; ajustes?: string; encaminhamentos?: string } | null;
        const dataRegistro = registro?.data ? (() => { const [a,m,d] = registro.data.split('-').map(Number); return new Date(a,m-1,d); })() : new Date(t.updated_at);
        list.push({ id: t.id, data: dataRegistro, tipo: `Acompanhamento técnico ${t.fu_tecnico_etapa}`,
          status: t.fu_tecnico_status ?? 'pendente', responsavel: registro?.coordenador ?? t.responsavel,
          isAuto: !registro, motivo: registro ? [registro.canal, registro.observacoes, registro.dificuldades, registro.ajustes, registro.encaminhamentos].filter(Boolean).join(' · ') : t.fu_tecnico_envio_erro });
      }

      (fus || []).forEach((f: any) => {
        // Always show the scheduled event
        const baseDate = f.concluido_em || f.updated_at || f.data_prevista || f.created_at;
        list.push({
          id: f.id,
          data: new Date(baseDate),
          tipo: TIPO_LABELS[f.tipo] || `Follow-up ${f.tipo}`,
          status: f.status,
          responsavel: f.concluido_por || 'Sistema',
          isAuto: isAutoResponsavel(f.concluido_por),
          motivo: f.cancelado_motivo,
        });
      });

      // Confirmações automáticas (campos no lead)
      if (lead?.confirmacao_24h_enviada_em) {
        list.push({
          id: 'conf24h',
          data: new Date(lead.confirmacao_24h_enviada_em),
          tipo: 'Confirmação do experimental (24h antes)',
          status: 'enviado',
          responsavel: 'Sistema',
          isAuto: true,
        });
      }
      if (lead?.confirmacao_2h_enviada_em) {
        list.push({
          id: 'conf2h',
          data: new Date(lead.confirmacao_2h_enviada_em),
          tipo: 'Lembrete 2 horas antes do treino',
          status: 'enviado',
          responsavel: 'Sistema',
          isAuto: true,
        });
      }
      // Follow-up legado (campo direto no lead)
      if (lead?.follow_up_whatsapp_enviado && lead?.follow_up_enviado_em) {
        list.push({
          id: 'fu_legado',
          data: new Date(lead.follow_up_enviado_em),
          tipo: 'Follow-up WhatsApp',
          status: 'enviado',
          responsavel: lead.follow_up_responsavel || 'Sistema',
          isAuto: isAutoResponsavel(lead.follow_up_responsavel),
        });
      }

      list.sort((a, b) => a.data.getTime() - b.data.getTime());

      if (alive) {
        setEvents(list);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [leadId, lead?.confirmacao_24h_enviada_em, lead?.confirmacao_2h_enviada_em, lead?.follow_up_enviado_em]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando histórico...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Bell className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm font-medium">Nenhum follow-up registrado ainda</p>
        <p className="text-xs">Eventos automáticos e manuais aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-3">
        {events.map((e) => {
          const st = STATUS_STYLE[e.status] || STATUS_STYLE.pendente;
          const StIcon = st.Icon;
          const RoleIcon = e.isAuto ? Bot : UserIcon;
          return (
            <div key={e.id} className="relative pl-14">
              <div className={cn(
                'absolute left-3 w-6 h-6 rounded-full flex items-center justify-center z-10',
                e.isAuto ? 'bg-indigo-500' : 'bg-emerald-600'
              )}>
                <MessageCircle className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-card border rounded-lg p-3 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{e.tipo}</span>
                    <Badge variant="outline" className={cn('text-xs', st.cls)}>
                      <StIcon className="w-3 h-3 mr-1" />
                      {st.label}
                    </Badge>
                    {e.motivo && (
                      <Badge variant="outline" className="text-xs border-muted">
                        motivo: {e.motivo}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />
                    {format(e.data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RoleIcon className="w-3 h-3" />
                  <span>Responsável: </span>
                  <span className="font-medium text-foreground">
                    {e.isAuto ? 'Sistema' : e.responsavel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
