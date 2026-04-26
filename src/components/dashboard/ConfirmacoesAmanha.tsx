import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Clock, Save, RefreshCw, AlertTriangle, MessageCircle, Calendar, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/errorMessages';
import { Lead, Interacao } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizePhoneForWhatsApp } from '@/components/WhatsAppLink';
import { EventoItem } from './EventosHoje';

interface ConfirmacoesAmanhaProps {
  items: EventoItem[];
  onRefresh: () => void;
  onReagendar: (item: EventoItem) => void;
}

export function ConfirmacoesAmanha({ items, onRefresh, onReagendar }: ConfirmacoesAmanhaProps) {
  const { toast } = useToast();
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const currentHour = new Date().getHours();
  const isLateWarning = currentHour >= 20;

  const handleConfirmar = async (item: EventoItem, checked: boolean) => {
    setLoading(prev => ({ ...prev, [item.interacao.id]: true }));
    
    const { error } = await supabase
      .from('interacoes')
      .update({ confirmado: checked })
      .eq('id', item.interacao.id);

    if (error) {
      toast({ title: 'Erro ao atualizar confirmação', description: getErrorMessage(error), variant: 'destructive' });
    } else {
      toast({ title: checked ? 'Confirmação registrada!' : 'Confirmação removida!' });
      onRefresh();
    }
    
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
      ? format(new Date(dataEvento + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
      : 'amanhã';
    const hora = horaEvento ? horaEvento.slice(0, 5) : '';
    
    const tipoTexto = isAvaliacao ? 'avaliação física' : 'aula experimental';
    const message = isAvaliacao
      ? `Olá, ${item.lead.nome}!

Sua ${tipoTexto} está confirmada para:
📅 ${dataFormatada}
🕙 ${hora}

Estamos empolgados para te conhecer e te proporcionar uma experiência incrível!

⚠️ Importante: Para garantir sua vaga, por favor confirme sua presença respondendo a esta mensagem.

Nos vemos em breve! 💪

Equipe IRON CLUB`
      : `Oi, ${item.lead.nome}! Tudo certo.

Sua aula experimental está confirmada:

📅 ${dataFormatada}

⏰ ${hora}

Chega com 10 minutos de antecedência e roupa de treino.

Confirma aqui que você vem.

Equipe IRON`;
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const getHoraEvento = (item: EventoItem): string => {
    if (item.tipoEvento === 'avaliacao') {
      const hora = item.interacao.hora_avaliacao;
      return hora ? hora.slice(0, 5).replace(/^0/, '') : '--:--';
    }
    const hora = item.interacao.hora_experimental;
    return hora ? hora.slice(0, 5).replace(/^0/, '') : '--:--';
  };

  return (
    <Card className={isLateWarning && items.length > 0 ? 'border-orange-500 border-2' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-sky-500" />
          Confirmações para Amanhã
        </CardTitle>
        <Badge variant="secondary">{items.length}</Badge>
      </CardHeader>
      <CardContent>
        {isLateWarning && items.length > 0 && (
          <div className="flex items-center gap-2 p-3 mb-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">
              Atenção: eventos ainda não confirmados após as 20h!
            </span>
          </div>
        )}
        
        {items.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Todos os eventos de amanhã foram confirmados
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {items.map((item) => (
              <div
                key={item.interacao.id}
                className={`p-4 rounded-lg space-y-3 ${
                  isLateWarning ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{item.lead.nome?.toUpperCase()}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openWhatsApp(item);
                      }}
                      className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Enviar lembrete
                    </button>
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
                      checked={item.interacao.confirmado || false}
                      onCheckedChange={(checked) => handleConfirmar(item, checked)}
                      disabled={loading[item.interacao.id]}
                    />
                    <span className="text-sm">Confirmar Presença</span>
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
