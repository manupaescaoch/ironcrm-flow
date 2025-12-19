import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Save, RefreshCw, MessageCircle, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lead, Interacao } from '@/types/database';
import { normalizePhoneForWhatsApp } from '@/components/WhatsAppLink';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface EventoItem {
  lead: Lead;
  interacao: Interacao;
  tipoEvento: 'experimental' | 'avaliacao';
}

interface EventosHojeProps {
  items: EventoItem[];
  onRefresh: () => void;
  onReagendar: (item: EventoItem) => void;
}

const statusLabels: Record<string, string> = {
  novo: 'Novo',
  contato_inicial: 'Contato Inicial',
  aula_agendada: 'Experimental Agendada',
  aula_realizada: 'Experimental Realizada',
  negociacao: 'Negociação',
  convertido: 'Convertido',
  perdido: 'Perdido',
};

export function EventosHoje({ items, onRefresh, onReagendar }: EventosHojeProps) {
  const { toast } = useToast();
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleMarcarPresenca = async (item: EventoItem, checked: boolean) => {
    setLoading(prev => ({ ...prev, [item.interacao.id]: true }));
    
    if (item.tipoEvento === 'experimental') {
      // Update interacao for experimental
      const { error: interacaoError } = await supabase
        .from('interacoes')
        .update({ compareceu: checked })
        .eq('id', item.interacao.id);

      if (interacaoError) {
        toast({ title: 'Erro ao atualizar presença', variant: 'destructive' });
        setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
        return;
      }

      // If marking as attended and hasn't closed matricula, update lead status to follow_up
      if (checked && !item.interacao.fechou_matricula) {
        const { error: leadError } = await supabase
          .from('leads')
          .update({ status_funil: 'follow_up' })
          .eq('id', item.lead.id);

        if (leadError) {
          console.error('Erro ao atualizar status do lead:', leadError);
        }
        toast({ title: 'Presença marcada! Lead movido para Follow Up.' });
      } else {
        toast({ title: checked ? 'Presença marcada!' : 'Presença desmarcada!' });
      }
    } else {
      // Update interacao for avaliação física
      const newStatus = checked ? 'realizada' : 'agendada';
      const { error } = await supabase
        .from('interacoes')
        .update({ status_avaliacao: newStatus })
        .eq('id', item.interacao.id);

      if (error) {
        toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
        setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
        return;
      }
      toast({ title: checked ? 'Avaliação realizada!' : 'Status atualizado!' });
    }
    
    onRefresh();
    setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
  };

  const handleSaveObs = async (item: EventoItem) => {
    const obs = observations[item.interacao.id];
    if (!obs) return;

    setLoading(prev => ({ ...prev, [`obs-${item.interacao.id}`]: true }));
    
    const { error } = await supabase
      .from('interacoes')
      .update({ descricao: obs })
      .eq('id', item.interacao.id);

    if (error) {
      toast({ title: 'Erro ao salvar observação', variant: 'destructive' });
    } else {
      toast({ title: 'Observação salva!' });
    }
    
    setLoading(prev => ({ ...prev, [`obs-${item.interacao.id}`]: false }));
  };

  const getPrimeiroNome = (nomeCompleto: string): string => {
    return nomeCompleto.split(' ')[0];
  };

  const openWhatsApp = (item: EventoItem) => {
    const phone = normalizePhoneForWhatsApp(item.lead.telefone || '');
    const isAvaliacao = item.tipoEvento === 'avaliacao';
    
    const dataEvento = isAvaliacao ? item.interacao.data_avaliacao : item.interacao.data_experimental;
    const horaEvento = isAvaliacao ? item.interacao.hora_avaliacao : item.interacao.hora_experimental;
    
    const dataFormatada = dataEvento 
      ? format(new Date(dataEvento + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
      : 'hoje';
    const hora = horaEvento || '';
    const primeiroNome = getPrimeiroNome(item.lead.nome);
    
    let message: string;
    
    if (isAvaliacao) {
      message = `Olá ${primeiroNome}!

Este é um lembrete da sua avaliação física agendada para:

📅 Data: ${dataFormatada}
🕐 Horário: ${hora}


⚠️ Informações Importantes para o Dia da Avaliação


🍽️ Alimentação

- Compareça em jejum de no mínimo 2 horas (sem comer ou beber).


👕 Vestimenta

- Remova relógios, colares, anéis e pulseiras

- A avaliação será realizada descalço e sem meias

- Vista roupas confortáveis


✅ Cuidados Prévios

- Evite bebidas alcoólicas no dia anterior

- Não realize exercícios antes da medição

- Utilize o banheiro antes do procedimento


Em caso de dúvidas ou necessidade de reagendamento, entre em contato conosco.


Aguardamos você! 💪`;
    } else {
      message = `Olá ${primeiroNome}! Sua aula experimental na IRON CLUB está confirmada para hoje (${dataFormatada}) às ${hora}. Estamos te esperando! 💪`;
    }
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const getPresencaChecked = (item: EventoItem): boolean => {
    if (item.tipoEvento === 'experimental') {
      return item.interacao.compareceu || false;
    }
    return item.interacao.status_avaliacao === 'realizada';
  };

  const getHoraEvento = (item: EventoItem): string => {
    if (item.tipoEvento === 'avaliacao') {
      return item.interacao.hora_avaliacao || '--:--';
    }
    return item.interacao.hora_experimental || '--:--';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Eventos de Hoje
        </CardTitle>
        <Badge variant="secondary">{items.length}</Badge>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhum evento agendado para hoje
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {items.map((item) => (
              <div
                key={item.interacao.id}
                className="p-4 bg-muted/50 rounded-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.lead.nome}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsApp(item);
                        }}
                        className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.lead.telefone || '-'}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {getHoraEvento(item)}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={item.tipoEvento === 'avaliacao' 
                        ? 'mt-1 bg-teal-100 text-teal-700 border-teal-300' 
                        : 'mt-1 bg-purple-100 text-purple-700 border-purple-300'
                      }
                    >
                      {item.tipoEvento === 'avaliacao' ? (
                        <><Activity className="w-3 h-3 mr-1" /> Avaliação</>
                      ) : (
                        <><Calendar className="w-3 h-3 mr-1" /> Experimental</>
                      )}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Obs. rápida"
                    value={observations[item.interacao.id] || item.interacao.descricao || ''}
                    onChange={(e) => setObservations(prev => ({ ...prev, [item.interacao.id]: e.target.value }))}
                    onBlur={() => handleSaveObs(item)}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSaveObs(item)}
                    disabled={loading[`obs-${item.interacao.id}`]}
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={getPresencaChecked(item)}
                      onCheckedChange={(checked) => handleMarcarPresenca(item, checked)}
                      disabled={loading[item.interacao.id]}
                    />
                    <span className="text-sm">Marcar Presença</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReagendar(item)}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Reagendar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
