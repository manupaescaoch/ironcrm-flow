import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, AlertTriangle, XCircle, CheckCircle, Phone, Eye, Zap, X, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { normalizePhoneForWhatsApp } from '@/components/WhatsAppLink';
import { useNavigate } from 'react-router-dom';
import { FollowUpAutoItem } from './AutoFollowUpCard';

interface UnifiedFollowUpCardProps {
  items: FollowUpAutoItem[];
  onRefresh: () => void;
  tipoFilter?: string | null;
  onClearFilter?: () => void;
}

const FOLLOW_UP_MESSAGES: Record<string, string> = {
  'D+1': `Oi, {{nome}}! Bom dia 😊

Passando pra saber como você acordou hoje depois do treino de ontem 💪
Sentiu o corpo?

Quando a gente fala de acompanhamento de perto, é justamente pra evoluir com segurança e constância, sem ficar perdido no treino.

Se fizer sentido pra você, posso te explicar com calma como funciona pra seguir treinando com a gente na IRON.`,
  'D+7': `Oi, {{nome}}! Tudo certo?
Passando pra saber o que achou da experiência na Iron 😊
Ficou alguma dúvida ou algo que você queira ajustar antes de decidir?`,
  'D+15': `{{nome}}, tudo bem?
Só passando pra alinhar contigo: ainda faz sentido pra você treinar com a gente na Iron?
Se quiser, consigo te explicar novamente os planos e ver o que encaixa melhor na tua rotina.`,
  'D+30': `Oi, {{nome}}!
Esse é meu último contato pra não ficar te incomodando 😊
Se ainda tiver interesse em treinar na Iron, é só me avisar que te explico tudo rapidinho.
Se não for o momento, sem problema nenhum.`,
};

const NOT_INTERESTED_REASONS = [
  { value: 'preco', label: 'Preço' },
  { value: 'tempo', label: 'Falta de tempo' },
  { value: 'nao_gostou', label: 'Não gostou do treino' },
  { value: 'testando', label: 'Só estava testando' },
  { value: 'outro', label: 'Outro' },
];

const TIPO_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  'D+1': { label: 'D+1', color: 'text-emerald-700', bgColor: 'bg-emerald-100', borderColor: 'border-emerald-400' },
  'D+7': { label: 'D+7', color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-400' },
  'D+15': { label: 'D+15', color: 'text-amber-700', bgColor: 'bg-amber-100', borderColor: 'border-amber-400' },
  'D+30': { label: 'D+30', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-400' },
};

export function UnifiedFollowUpCard({ items, onRefresh, tipoFilter, onClearFilter }: UnifiedFollowUpCardProps) {
  const navigate = useNavigate();
  const { userName } = useAuth();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [notInterestedModalOpen, setNotInterestedModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FollowUpAutoItem | null>(null);
  const [selectedReason, setSelectedReason] = useState('preco');
  const [loading, setLoading] = useState(false);

  const filteredItems = tipoFilter 
    ? items.filter(item => item.tipo === tipoFilter)
    : items;

  const getTimeInfo = (item: FollowUpAutoItem) => {
    try {
      const dataPrevista = parseISO(item.data_prevista);
      const hoje = new Date();
      const diasAtraso = differenceInDays(hoje, dataPrevista);
      
      if (diasAtraso > 0) {
        return { 
          text: `${diasAtraso}d atrasado`, 
          color: 'text-red-600',
          isLate: true 
        };
      } else if (diasAtraso === 0) {
        return { text: 'Hoje', color: 'text-amber-600', isLate: false };
      } else {
        return { 
          text: `Em ${Math.abs(diasAtraso)}d`, 
          color: 'text-muted-foreground',
          isLate: false 
        };
      }
    } catch {
      return { text: '-', color: 'text-muted-foreground', isLate: false };
    }
  };

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aInfo = getTimeInfo(a);
      const bInfo = getTimeInfo(b);
      
      if (a.tipo === 'D+1' && b.tipo !== 'D+1') return -1;
      if (a.tipo !== 'D+1' && b.tipo === 'D+1') return 1;
      
      if (aInfo.isLate && !bInfo.isLate) return -1;
      if (!aInfo.isLate && bInfo.isLate) return 1;
      
      return new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime();
    });
  }, [filteredItems]);

  const lateCount = filteredItems.filter(i => getTimeInfo(i).isLate).length;
  const d1Count = filteredItems.filter(i => i.tipo === 'D+1').length;

  const handleSendWhatsApp = (item: FollowUpAutoItem) => {
    const firstName = item.lead.nome.split(' ')[0];
    const message = FOLLOW_UP_MESSAGES[item.tipo].replace(/\{\{nome\}\}/g, firstName);
    const phone = normalizePhoneForWhatsApp(item.lead.telefone || '');
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    
    setSelectedItem(item);
    setConfirmModalOpen(true);
  };

  const handleConfirmSent = async () => {
    if (!selectedItem) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('follow_ups')
        .update({
          status: 'concluido',
          concluido_por: userName || 'Sistema',
          concluido_em: new Date().toISOString(),
        })
        .eq('id', selectedItem.id);

      if (error) throw error;
      
      await supabase
        .from('interacoes')
        .insert({
          lead_id: selectedItem.lead_id,
          tipo: 'Follow Up',
          descricao: `Follow-up ${selectedItem.tipo} realizado via WhatsApp`,
          data_interacao: new Date().toISOString(),
          atendido_por: userName || 'Sistema',
        });
      
      toast.success(`Follow-up ${selectedItem.tipo} concluído!`);
      setConfirmModalOpen(false);
      setSelectedItem(null);
      onRefresh();
    } catch (error) {
      console.error('Erro ao marcar follow-up:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  const handleNotInterested = (item: FollowUpAutoItem) => {
    setSelectedItem(item);
    setSelectedReason('preco');
    setNotInterestedModalOpen(true);
  };

  const handleConfirmNotInterested = async () => {
    if (!selectedItem) return;
    
    setLoading(true);
    try {
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status_funil: 'perdido' })
        .eq('id', selectedItem.lead_id);

      if (leadError) throw leadError;

      await supabase
        .from('follow_ups')
        .update({ status: 'cancelado' })
        .eq('lead_id', selectedItem.lead_id)
        .eq('status', 'pendente');

      const reasonLabel = NOT_INTERESTED_REASONS.find(r => r.value === selectedReason)?.label || 'Outro';
      await supabase
        .from('interacoes')
        .insert({
          lead_id: selectedItem.lead_id,
          tipo: 'Encerramento',
          descricao: `Lead marcado como não interessado no ${selectedItem.tipo}. Motivo: ${reasonLabel}`,
          data_interacao: new Date().toISOString(),
          atendido_por: userName || 'Sistema',
        });
      
      toast.success('Lead marcado como não interessado');
      setNotInterestedModalOpen(false);
      setSelectedItem(null);
      onRefresh();
    } catch (error) {
      console.error('Erro ao marcar lead:', error);
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
          concluido_por: userName || 'Sistema',
          concluido_em: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (error) throw error;
      
      await supabase
        .from('interacoes')
        .insert({
          lead_id: item.lead_id,
          tipo: 'Follow Up',
          descricao: `Follow-up ${item.tipo} marcado como realizado`,
          data_interacao: new Date().toISOString(),
          atendido_por: userName || 'Sistema',
        });
      
      toast.success(`Follow-up ${item.tipo} concluído!`);
      onRefresh();
    } catch (error) {
      console.error('Erro ao marcar follow-up:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Follow-ups Pendentes
            {tipoFilter && (
              <Badge className="ml-2 bg-primary text-primary-foreground text-xs">
                {tipoFilter}
                <button 
                  onClick={(e) => { e.stopPropagation(); onClearFilter?.(); }}
                  className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1.5">
            {d1Count > 0 && !tipoFilter && (
              <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 text-xs animate-pulse">
                <Zap className="w-3 h-3 mr-0.5" />
                {d1Count} D+1
              </Badge>
            )}
            {lateCount > 0 && (
              <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50 text-xs">
                {lateCount} atrasado{lateCount !== 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {filteredItems.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sortedItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground px-4">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-50 text-green-500" />
            <p className="text-sm">
              {tipoFilter 
                ? `Nenhum follow-up ${tipoFilter} pendente.` 
                : 'Nenhum follow-up pendente!'}
            </p>
            {tipoFilter && onClearFilter && (
              <Button variant="link" onClick={onClearFilter} className="mt-1 text-xs">
                Ver todos
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {sortedItems.map((item) => {
                const timeInfo = getTimeInfo(item);
                const tipoInfo = TIPO_CONFIG[item.tipo];
                const isD1 = item.tipo === 'D+1';
                
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "p-3 transition-all",
                      isD1 && !timeInfo.isLate && "bg-emerald-50/50 dark:bg-emerald-950/20",
                      timeInfo.isLate && "bg-red-50/50 dark:bg-red-950/20"
                    )}
                  >
                    {/* Row 1: Info + Actions */}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={cn(tipoInfo.bgColor, tipoInfo.color, "text-xs font-bold min-w-[38px] justify-center")}>
                        {tipoInfo.label}
                      </Badge>
                      
                      {isD1 && !timeInfo.isLate && (
                        <Zap className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      {timeInfo.isLate && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      
                      <span className="font-medium text-sm flex-1 truncate">
                        {item.lead.nome?.toUpperCase()}
                      </span>
                      
                      <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {item.lead.telefone || '-'}
                      </span>
                      
                      <span className={cn("text-xs font-medium", timeInfo.color)}>
                        {timeInfo.text}
                      </span>
                      
                      {/* Inline action buttons */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-600 hover:bg-green-100"
                        onClick={() => handleMarkAsCompleted(item)}
                        disabled={loading}
                        title="Marcar como Realizado"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-600 hover:bg-red-100"
                        onClick={() => handleNotInterested(item)}
                        disabled={loading}
                        title="Não Interessado"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Row 2: Reference + Last Interaction + WhatsApp */}
                    <div className="flex items-center justify-between pl-12">
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>
                          Ref: {format(parseISO(item.data_referencia), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        {item.ultima_interacao && (
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            Último contato: {format(parseISO(item.ultima_interacao), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => navigate(`/lead/${item.lead_id}`)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Ver
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                          onClick={() => handleSendWhatsApp(item)}
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Confirm Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envio do Follow-Up {selectedItem?.tipo}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Você enviou a mensagem para <strong>{selectedItem?.lead.nome}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmSent} disabled={loading}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Not Interested Modal */}
      <Dialog open={notInterestedModalOpen} onOpenChange={setNotInterestedModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como não interessado</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium">Motivo:</Label>
            <RadioGroup 
              value={selectedReason} 
              onValueChange={setSelectedReason}
              className="mt-2 space-y-2"
            >
              {NOT_INTERESTED_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label htmlFor={reason.value} className="font-normal">{reason.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotInterestedModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmNotInterested} 
              disabled={loading}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
