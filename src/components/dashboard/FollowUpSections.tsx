import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CalendarDays, X, Phone, Check, UserX, Eye, MessageCircle } from 'lucide-react';
import { FollowUpAutoItem } from '@/components/dashboard/AutoFollowUpCard';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { format, differenceInDays, isToday, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FollowUpSectionsProps {
  urgentItems: FollowUpAutoItem[];
  upcomingItems: FollowUpAutoItem[];
  onRefresh: () => void;
  tipoFilter: string | null;
  onClearFilter: () => void;
  onTipoClick: (tipo: string) => void;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'D+1': { label: 'D+1', color: 'text-green-700', bgColor: 'bg-green-100' },
  'D+7': { label: 'D+7', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'D+15': { label: 'D+15', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  'D+30': { label: 'D+30', color: 'text-red-700', bgColor: 'bg-red-100' },
};

const NOT_INTERESTED_REASONS = [
  'Não tem interesse',
  'Mudou de cidade',
  'Optou por outra academia',
  'Problemas financeiros',
  'Problemas de saúde',
  'Sem tempo disponível',
  'Não atende / Telefone inválido',
  'Outro',
];

const FOLLOW_UP_MESSAGES: Record<string, (nome: string) => string> = {
  'D+1': (nome) => `Oi, ${nome}! Como foi o corpo hoje depois do treino de ontem?

Primeira sessão sempre dá aquela sensação de que o músculo acordou.

Se quiser continuar treinando com estrutura e acompanhamento, me fala. Te explico como funciona aqui na IRON em 2 minutos.`,
  'D+7': (nome) => `${nome}, faz uma semana desde sua experimental aqui na IRON.

Voltou a treinar? Em outro lugar ou parou por enquanto?

Pergunto porque dependendo da sua situação, posso te mostrar uma opção que faz mais sentido pro seu momento agora.`,
  'D+15': (nome) => `${nome}, passando de forma direta:

Você veio, treinou, sentiu na prática como é a estrutura da IRON.

Esse mês ainda tem condição de entrada diferenciada. Se você tiver considerando, agora é o momento certo pra bater o martelo.

Quer saber os valores?`,
  'D+30': (nome) => `${nome}, último contato da minha parte.

Faz 30 dias desde sua experimental. Se ainda não tomou uma decisão, provavelmente ainda tem alguma dúvida ou travamento.

Me fala o que tá segurando. Às vezes é simples de resolver.

As portas da IRON estão abertas, mas não vou ficar insistindo infinitamente. Decisão é sua.`,
};

export function FollowUpSections({ 
  urgentItems, 
  upcomingItems, 
  onRefresh, 
  tipoFilter, 
  onClearFilter,
  onTipoClick
}: FollowUpSectionsProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [notInterestedModalOpen, setNotInterestedModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FollowUpAutoItem | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');

  // Filter items by tipo if filter is active
  const filteredUrgentItems = useMemo(() => {
    if (!tipoFilter) return urgentItems;
    return urgentItems.filter(item => item.tipo === tipoFilter);
  }, [urgentItems, tipoFilter]);

  const filteredUpcomingItems = useMemo(() => {
    if (!tipoFilter) return upcomingItems;
    return upcomingItems.filter(item => item.tipo === tipoFilter);
  }, [upcomingItems, tipoFilter]);

  // Sort urgent items: D+1 first, then by days overdue
  const sortedUrgentItems = useMemo(() => {
    return [...filteredUrgentItems].sort((a, b) => {
      // D+1 always first
      if (a.tipo === 'D+1' && b.tipo !== 'D+1') return -1;
      if (b.tipo === 'D+1' && a.tipo !== 'D+1') return 1;
      // Then by date (older first)
      return new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime();
    });
  }, [filteredUrgentItems]);

  // Sort upcoming items by date
  const sortedUpcomingItems = useMemo(() => {
    return [...filteredUpcomingItems].sort((a, b) => 
      new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime()
    );
  }, [filteredUpcomingItems]);

  const getTimeInfo = (dataPrevista: string) => {
    const date = new Date(dataPrevista);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diff = differenceInDays(date, hoje);
    
    if (isToday(date)) {
      return { text: 'Hoje', className: 'text-amber-600 bg-amber-100' };
    } else if (isPast(date)) {
      const daysOverdue = Math.abs(diff);
      return { 
        text: `${daysOverdue}d atrasado`, 
        className: 'text-red-600 bg-red-100' 
      };
    } else {
      return { 
        text: `Em ${diff}d`, 
        className: 'text-muted-foreground bg-muted' 
      };
    }
  };

  const handleSendWhatsApp = (item: FollowUpAutoItem) => {
    setSelectedItem(item);
    setConfirmModalOpen(true);
  };

  const handleConfirmSent = async () => {
    if (!selectedItem) return;
    setLoading(true);
    
    try {
      // Update follow-up status
      const { error: followUpError } = await supabase
        .from('follow_ups')
        .update({ 
          status: 'concluido',
          concluido_em: new Date().toISOString(),
          concluido_por: 'dashboard'
        })
        .eq('id', selectedItem.id);

      if (followUpError) throw followUpError;

      // Log interaction
      await supabase.from('interacoes').insert({
        lead_id: selectedItem.lead_id,
        tipo: 'follow_up',
        descricao: `Follow-up ${selectedItem.tipo.toUpperCase()} realizado via WhatsApp`,
        data_interacao: new Date().toISOString(),
      });

      toast.success('Follow-up marcado como realizado!');
      setConfirmModalOpen(false);
      setSelectedItem(null);
      onRefresh();
    } catch (error) {
      console.error('Erro ao confirmar follow-up:', error);
      toast.error('Erro ao atualizar follow-up');
    } finally {
      setLoading(false);
    }
  };

  const handleNotInterested = (item: FollowUpAutoItem) => {
    setSelectedItem(item);
    setSelectedReason('');
    setNotInterestedModalOpen(true);
  };

  const handleConfirmNotInterested = async () => {
    if (!selectedItem || !selectedReason) return;
    setLoading(true);
    
    try {
      // Update lead status to perdido
      const { error: leadError } = await supabase
        .from('leads')
        .update({ 
          status_funil: 'perdido',
          motivo_perda: selectedReason,
          data_perda: new Date().toISOString(),
        })
        .eq('id', selectedItem.lead_id);

      if (leadError) throw leadError;

      // Cancel all pending follow-ups for this lead
      await supabase
        .from('follow_ups')
        .update({ 
          status: 'cancelado',
          cancelado_motivo: 'perdido'
        })
        .eq('lead_id', selectedItem.lead_id)
        .eq('status', 'pendente');

      toast.success('Lead marcado como não interessado');
      setNotInterestedModalOpen(false);
      setSelectedItem(null);
      setSelectedReason('');
      onRefresh();
    } catch (error) {
      console.error('Erro ao marcar como não interessado:', error);
      toast.error('Erro ao atualizar lead');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsCompleted = async (item: FollowUpAutoItem) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('follow_ups')
        .update({ 
          status: 'concluido',
          concluido_em: new Date().toISOString(),
          concluido_por: 'dashboard'
        })
        .eq('id', item.id);

      if (error) throw error;
      toast.success('Follow-up marcado como realizado!');
      onRefresh();
    } catch (error) {
      console.error('Erro ao marcar como realizado:', error);
      toast.error('Erro ao atualizar follow-up');
    } finally {
      setLoading(false);
    }
  };

  const renderFollowUpItem = (item: FollowUpAutoItem, isUrgent: boolean) => {
    const tipoConfig = TIPO_CONFIG[item.tipo] || TIPO_CONFIG['D+1'];
    const timeInfo = getTimeInfo(item.data_prevista);
    const leadNome = item.lead?.nome?.split(' ')[0] || 'Lead';
    const messageFunc = FOLLOW_UP_MESSAGES[item.tipo] || FOLLOW_UP_MESSAGES['D+1'];
    const message = messageFunc(leadNome);

    return (
      <div 
        key={item.id} 
        className={cn(
          "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border gap-3",
          isUrgent ? "bg-background" : "bg-muted/30"
        )}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Badge 
            className={cn("shrink-0 cursor-pointer hover:opacity-80 transition-opacity", tipoConfig.bgColor, tipoConfig.color)}
            onClick={() => onTipoClick(item.tipo)}
            title={`Filtrar por ${tipoConfig.label}`}
          >
            {tipoConfig.label}
          </Badge>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{item.lead?.nome || 'Lead não encontrado'}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {item.lead?.telefone && (
                <WhatsAppLink
                  phone={item.lead.telefone}
                  message={message}
                  showIcon={true}
                  className="text-green-600 hover:text-green-700"
                />
              )}
              <Badge variant="outline" className={cn("text-xs", timeInfo.className)}>
                {timeInfo.text}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleMarkAsCompleted(item)}
            disabled={loading}
            title="Marcar como realizado"
          >
            <Check className="w-4 h-4 text-green-600" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNotInterested(item)}
            disabled={loading}
            title="Não interessado"
          >
            <UserX className="w-4 h-4 text-orange-600" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/lead/${item.lead_id}`)}
            title="Ver lead"
          >
            <Eye className="w-4 h-4" />
          </Button>
          
          {item.lead?.telefone && (
            <WhatsAppLink
              phone={item.lead.telefone}
              message={message}
              iconOnly
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filter indicator */}
      {tipoFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            Filtro: {TIPO_CONFIG[tipoFilter]?.label || tipoFilter}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onClearFilter}>
            <X className="w-4 h-4" />
            Limpar
          </Button>
        </div>
      )}

      {/* Urgent Section */}
      <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>Vencidos / Hoje</span>
            </div>
            <Badge variant="destructive">{sortedUrgentItems.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedUrgentItems.length > 0 ? (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2 pr-4">
                {sortedUrgentItems.map(item => renderFollowUpItem(item, true))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p>Nenhum follow-up vencido ou para hoje!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Section */}
      <Card className="border-slate-200 bg-gradient-to-br from-slate-50/50 to-background dark:from-slate-950/20 dark:to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-slate-500" />
              <span>Próximos Follow-ups</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Quick type counters */}
              {['D+7', 'D+15', 'D+30'].map(tipo => {
                const count = sortedUpcomingItems.filter(i => i.tipo === tipo).length;
                if (count === 0) return null;
                const config = TIPO_CONFIG[tipo];
                return (
                  <Badge 
                    key={tipo} 
                    variant="outline" 
                    className={cn("text-xs cursor-pointer hover:opacity-80", config.bgColor, config.color)}
                    onClick={() => onTipoClick(tipo)}
                  >
                    {tipo}: {count}
                  </Badge>
                );
              })}
              <Badge variant="secondary">{sortedUpcomingItems.length}</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {sortedUpcomingItems.length > 0 ? (
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-2">
                {sortedUpcomingItems.map(item => renderFollowUpItem(item, false))}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum follow-up agendado para os próximos dias</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm WhatsApp Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envio de WhatsApp</DialogTitle>
            <DialogDescription>
              Você enviou a mensagem de follow-up para {selectedItem?.lead?.nome}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmSent} disabled={loading}>
              {loading ? 'Salvando...' : 'Sim, enviei'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Not Interested Modal */}
      <Dialog open={notInterestedModalOpen} onOpenChange={setNotInterestedModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como não interessado</DialogTitle>
            <DialogDescription>
              Selecione o motivo pelo qual {selectedItem?.lead?.nome} não tem interesse:
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedReason} onValueChange={setSelectedReason}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o motivo" />
            </SelectTrigger>
            <SelectContent>
              {NOT_INTERESTED_REASONS.map(reason => (
                <SelectItem key={reason} value={reason}>{reason}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotInterestedModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmNotInterested} 
              disabled={loading || !selectedReason}
              variant="destructive"
            >
              {loading ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}