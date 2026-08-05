import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Clock, Save, RefreshCw, AlertTriangle, MessageCircle, Calendar, Activity, CheckCircle2, FileText, BellRing, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/errorMessages';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizePhoneForWhatsApp } from '@/components/WhatsAppLink';
import { EventoItem } from './EventosHoje';
import { formatTimestampInBrasilia, getCurrentHourInBrasilia } from '@/lib/brasilia';

interface ConfirmacoesAmanhaProps {
  items: EventoItem[];
  onRefresh: () => void;
  onReagendar: (item: EventoItem) => void;
}

export function ConfirmacoesAmanha({ items, onRefresh, onReagendar }: ConfirmacoesAmanhaProps) {
  const { toast } = useToast();
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [anamneseMap, setAnamneseMap] = useState<Record<string, boolean>>({});
  const [lembreteMap, setLembreteMap] = useState<Record<string, string | null>>({});

  const currentHour = getCurrentHourInBrasilia();
  const isLateWarning = currentHour >= 20;

  useEffect(() => {
    const leadIds = Array.from(new Set(items.map(i => i.lead.id)));
    if (leadIds.length === 0) {
      setAnamneseMap({});
      setLembreteMap({});
      return;
    }
    (async () => {
      const [anamRes, leadsRes] = await Promise.all([
        supabase.from('anamneses_experimental').select('lead_id').in('lead_id', leadIds),
        supabase.from('leads').select('id, confirmacao_24h_enviada_em').in('id', leadIds),
      ]);
      const am: Record<string, boolean> = {};
      anamRes.data?.forEach((r: any) => { am[r.lead_id] = true; });
      setAnamneseMap(am);
      const lm: Record<string, string | null> = {};
      leadsRes.data?.forEach((r: any) => { lm[r.id] = r.confirmacao_24h_enviada_em; });
      setLembreteMap(lm);
    })();
  }, [items]);

  const handleConfirmar = async (item: EventoItem, checked: boolean) => {
    setLoading(prev => ({ ...prev, [item.interacao.id]: true }));
    const { error } = await supabase.from('interacoes').update({ confirmado: checked }).eq('id', item.interacao.id);
    if (error) {
      toast({ title: 'Erro ao atualizar confirmação', description: getErrorMessage(error), variant: 'destructive' });
    } else {
      toast({ title: checked ? 'Confirmação registrada!' : 'Confirmação removida!' });
      onRefresh();
    }
    setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
  };

  const handleAgendarEvo = async (item: EventoItem) => {
    setLoading(prev => ({ ...prev, [`evo-${item.interacao.id}`]: true }));
    const { error } = await supabase
      .from('interacoes')
      .update({ agendado_evo: true } as any)
      .eq('id', item.interacao.id);
    if (error) {
      toast({ title: 'Erro ao registrar no EVO', description: getErrorMessage(error), variant: 'destructive' });
    } else {
      toast({ title: 'Agendado no EVO!' });
      onRefresh();
    }
    setLoading(prev => ({ ...prev, [`evo-${item.interacao.id}`]: false }));
  };

  const handleSaveObs = async (item: EventoItem) => {
    const obs = observations[item.interacao.id];
    if (!obs) return;
    setLoading(prev => ({ ...prev, [`obs-${item.interacao.id}`]: true }));
    const { error } = await supabase.from('interacoes').update({ descricao: obs }).eq('id', item.interacao.id);
    if (error) {
      toast({ title: 'Erro ao salvar observação', description: getErrorMessage(error), variant: 'destructive' });
    } else {
      toast({ title: 'Observação salva!' });
    }
    setLoading(prev => ({ ...prev, [`obs-${item.interacao.id}`]: false }));
  };

  const openWhatsApp = (item: EventoItem) => {
    const phone = normalizePhoneForWhatsApp(item.lead.telefone || '');
    const isAvaliacao = item.tipoEvento === 'avaliacao';
    const dataEvento = isAvaliacao ? item.interacao.data_avaliacao : item.interacao.data_experimental;
    const horaEvento = isAvaliacao ? item.interacao.hora_avaliacao : item.interacao.hora_experimental;
    const dataFormatada = dataEvento
      ? format(new Date(dataEvento + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
      : 'amanhã';
    const hora = horaEvento ? horaEvento.slice(0, 5) : '';
    const tipoTexto = isAvaliacao ? 'avaliação física' : 'aula experimental';
    const message = isAvaliacao
      ? `Olá, ${item.lead.nome}!\n\nSua ${tipoTexto} está confirmada para:\n📅 ${dataFormatada}\n🕙 ${hora}\n\nEquipe EVO TRAINING CLUB`
      : `Oi, ${item.lead.nome}! Sua aula experimental está confirmada:\n\n📅 ${dataFormatada}\n🕙 ${hora}\n\nChegar com 10min de antecedência.\n\nEquipe IRON`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const getHoraEvento = (item: EventoItem): string => {
    const hora = item.tipoEvento === 'avaliacao' ? item.interacao.hora_avaliacao : item.interacao.hora_experimental;
    return hora ? hora.slice(0, 5).replace(/^0/, '') : '--:--';
  };

  return (
    <Card className={isLateWarning && items.length > 0 ? 'border-orange-500 border-2' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-sky-500" />
          Agendamentos para Amanhã
        </CardTitle>
        <Badge variant="secondary">{items.length}</Badge>
      </CardHeader>
      <CardContent>
        {isLateWarning && items.length > 0 && (
          <div className="flex items-center gap-2 p-3 mb-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Atenção: agendamentos ainda não confirmados após as 20h!</span>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Nenhum agendamento pendente para amanhã</p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {items.map((item) => {
              const phone = item.lead.telefone || '';
              const anamneseOk = !!anamneseMap[item.lead.id];
              const lembreteOk = !!lembreteMap[item.lead.id];
              const evoOk = !!(item.interacao as any).agendado_evo;
              return (
                <div
                  key={item.interacao.id}
                  className={`p-4 rounded-lg space-y-3 ${
                    isLateWarning ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{item.lead.nome?.toUpperCase()}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); openWhatsApp(item); }}
                        className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {phone || 'Sem telefone'}
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground justify-end">
                        <Clock className="w-4 h-4" />
                        {getHoraEvento(item)}
                      </div>
                      <Badge
                        variant="outline"
                        className={item.tipoEvento === 'avaliacao'
                          ? 'mt-1 bg-teal-100 text-teal-700 border-teal-300'
                          : 'mt-1 bg-purple-100 text-purple-700 border-purple-300'}
                      >
                        {item.tipoEvento === 'avaliacao' ? (
                          <><Activity className="w-3 h-3 mr-1" /> Avaliação</>
                        ) : (
                          <><Calendar className="w-3 h-3 mr-1" /> Experimental</>
                        )}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={anamneseOk
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-300'}>
                      <FileText className="w-3 h-3 mr-1" />
                      {anamneseOk ? 'Anamnese preenchida' : 'Anamnese pendente'}
                    </Badge>
                    <Badge variant="outline" className={lembreteOk
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-300'}>
                      <BellRing className="w-3 h-3 mr-1" />
                        {lembreteOk
                        ? `Lembrete 24h enviado às ${formatTimestampInBrasilia(lembreteMap[item.lead.id] as string).slice(-5)}`
                        : 'Lembrete pendente'}
                    </Badge>
                  </div>

                  {evoOk ? (
                    <div className="flex items-center justify-center gap-2 w-full rounded-md bg-green-600 text-white py-2.5 text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Agendado no EVO
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleAgendarEvo(item)}
                      disabled={loading[`evo-${item.interacao.id}`]}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Confirmar no EVO
                    </Button>
                  )}

                  <div className="flex items-center justify-end">
                    <Button size="sm" variant="ghost" onClick={() => onReagendar(item)} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      Reagendar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
