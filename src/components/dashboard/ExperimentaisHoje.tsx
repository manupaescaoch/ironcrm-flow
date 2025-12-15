import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Save, RefreshCw, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lead, Interacao } from '@/types/database';
import { normalizePhoneForWhatsApp } from '@/components/WhatsAppLink';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExperimentalItem {
  lead: Lead;
  interacao: Interacao;
}

interface ExperimentaisHojeProps {
  items: ExperimentalItem[];
  onRefresh: () => void;
  onReagendar: (item: ExperimentalItem) => void;
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

export function ExperimentaisHoje({ items, onRefresh, onReagendar }: ExperimentaisHojeProps) {
  const { toast } = useToast();
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleMarcarPresenca = async (item: ExperimentalItem) => {
    setLoading(prev => ({ ...prev, [item.interacao.id]: true }));
    
    const { error } = await supabase
      .from('interacoes')
      .update({ compareceu: true })
      .eq('id', item.interacao.id);

    if (error) {
      toast({ title: 'Erro ao marcar presença', variant: 'destructive' });
    } else {
      toast({ title: 'Presença marcada!' });
      onRefresh();
    }
    
    setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
  };

  const handleSaveObs = async (item: ExperimentalItem) => {
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

  const openWhatsApp = (item: ExperimentalItem) => {
    const phone = normalizePhoneForWhatsApp(item.lead.telefone || '');
    const dataFormatada = item.interacao.data_experimental 
      ? format(new Date(item.interacao.data_experimental + 'T12:00:00'), "dd/MM", { locale: ptBR })
      : 'hoje';
    const hora = item.interacao.hora_experimental || '';
    
    const message = `Olá ${item.lead.nome}! Sua aula experimental na IRON CLUB está confirmada para hoje (${dataFormatada}) às ${hora}. Estamos te esperando! 💪`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Experimentais de Hoje
        </CardTitle>
        <Badge variant="secondary">{items.length}</Badge>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma aula experimental agendada para hoje
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
                      {item.interacao.hora_experimental || '--:--'}
                    </div>
                    <Badge variant="outline" className="mt-1">
                      {statusLabels[item.lead.status_funil] || item.lead.status_funil}
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
                      checked={item.interacao.compareceu || false}
                      onCheckedChange={() => handleMarcarPresenca(item)}
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
