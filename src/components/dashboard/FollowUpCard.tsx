import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Lead, Interacao } from '@/types/database';
import { MessageCircle, AlertTriangle, Clock, XCircle, CheckCircle, Info, Phone, Eye, History, ChevronDown, ChevronUp, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, differenceInHours, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WhatsAppLink, normalizePhoneForWhatsApp } from '@/components/WhatsAppLink';
import { useNavigate } from 'react-router-dom';
import { EventoItem } from './EventosHoje';

interface CompletedFollowUp {
  id: string;
  nome: string;
  telefone: string | null;
  follow_up_enviado_em: string | null;
  follow_up_responsavel: string | null;
  status_funil: string;
}

interface FollowUpCardProps {
  items: EventoItem[];
  onRefresh: () => void;
}

const FOLLOW_UP_MESSAGE = `Oi, {{nome}}! Tudo bem?

Queria saber como você se sentiu na EVO! Gostou do treino e do espaço?

A gente se dedica muito a criar um ambiente acolhedor e exclusivo, com acompanhamento de perto pra você treinar com tranquilidade e ter resultados de verdade.

Se você curtiu e quiser fazer parte do time, fico feliz em te ajudar com os próximos passos 😊`;

const NOT_INTERESTED_REASONS = [
  { value: 'preco', label: 'Preço' },
  { value: 'tempo', label: 'Falta de tempo' },
  { value: 'nao_gostou', label: 'Não gostou do treino' },
  { value: 'testando', label: 'Só estava testando' },
  { value: 'outro', label: 'Outro' },
];

export function FollowUpCard({ items, onRefresh }: FollowUpCardProps) {
  const navigate = useNavigate();
  const { userName, isAdmin, user } = useAuth();
  const { unidadeAtual } = useUnidade();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmDoneModalOpen, setConfirmDoneModalOpen] = useState(false);
  const [notInterestedModalOpen, setNotInterestedModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EventoItem | null>(null);
  const [selectedReason, setSelectedReason] = useState('preco');
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [completedFollowUps, setCompletedFollowUps] = useState<CompletedFollowUp[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch completed follow-ups when history is opened
  useEffect(() => {
    if (historyOpen && unidadeAtual) {
      fetchCompletedFollowUps();
    }
  }, [historyOpen, unidadeAtual]);

  const fetchCompletedFollowUps = async () => {
    if (!unidadeAtual) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, nome, telefone, follow_up_enviado_em, follow_up_responsavel, status_funil')
        .eq('unidade_id', unidadeAtual.id)
        .eq('follow_up_whatsapp_enviado', true)
        .order('follow_up_enviado_em', { ascending: false })
        .limit(20);

      if (error) throw error;
      setCompletedFollowUps(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getTimeSinceClass = (item: EventoItem) => {
    const dateStr = item.interacao.data_experimental;
    const timeStr = item.interacao.hora_experimental;
    
    if (!dateStr) return { hours: 0, text: '-', color: 'text-muted-foreground' };
    
    try {
      const dateTimeStr = timeStr 
        ? `${dateStr}T${timeStr}` 
        : `${dateStr}T12:00:00`;
      const classDate = parseISO(dateTimeStr);
      const hours = differenceInHours(new Date(), classDate);
      
      let color = 'text-muted-foreground';
      if (hours >= 48) color = 'text-red-600';
      else if (hours >= 24) color = 'text-orange-500';
      
      const text = formatDistanceToNow(classDate, { locale: ptBR, addSuffix: true });
      
      return { hours, text, color };
    } catch {
      return { hours: 0, text: '-', color: 'text-muted-foreground' };
    }
  };

  const isLateFollowUp = (item: EventoItem) => {
    const { hours } = getTimeSinceClass(item);
    return hours >= 48 && !item.lead.follow_up_whatsapp_enviado;
  };

  const handleSendFollowUp = (item: EventoItem) => {
    const message = FOLLOW_UP_MESSAGE.replace('{{nome}}', item.lead.nome.split(' ')[0]);
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
        .from('leads')
        .update({
          follow_up_whatsapp_enviado: true,
          follow_up_enviado_em: new Date().toISOString(),
          follow_up_responsavel: userName || 'Sistema',
        })
        .eq('id', selectedItem.lead.id);

      if (error) throw error;
      
      toast.success('Follow up marcado como enviado!');
      setConfirmModalOpen(false);
      setSelectedItem(null);
      onRefresh();
    } catch (error) {
      console.error('Erro ao marcar follow up:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsDone = (item: EventoItem) => {
    setSelectedItem(item);
    setConfirmDoneModalOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!selectedItem) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          follow_up_whatsapp_enviado: true,
          follow_up_enviado_em: new Date().toISOString(),
          follow_up_responsavel: userName || 'Sistema',
        })
        .eq('id', selectedItem.lead.id);

      if (error) throw error;
      
      toast.success('Follow up marcado como realizado!');
      setConfirmDoneModalOpen(false);
      setSelectedItem(null);
      onRefresh();
    } catch (error) {
      console.error('Erro ao marcar follow up:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  const handleNotInterested = (item: EventoItem) => {
    setSelectedItem(item);
    setSelectedReason('preco');
    setNotInterestedModalOpen(true);
  };

  const handleConfirmNotInterested = async () => {
    if (!selectedItem) return;
    
    setLoading(true);
    try {
      // Update lead status
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status_funil: 'perdido',
        })
        .eq('id', selectedItem.lead.id);

      if (leadError) throw leadError;

      // Create interaction record
      const reasonLabel = NOT_INTERESTED_REASONS.find(r => r.value === selectedReason)?.label || 'Outro';
      const { error: interacaoError } = await supabase
        .from('interacoes')
        .insert({
          lead_id: selectedItem.lead.id,
          tipo: 'Encerramento',
          descricao: `Lead marcado como não interessado. Motivo: ${reasonLabel}`,
          data_interacao: new Date().toISOString(),
          atendido_por: userName || 'Sistema',
        });

      if (interacaoError) throw interacaoError;
      
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

  // Filter only pending items (not yet sent)
  const pendingItems = items.filter(i => !i.lead.follow_up_whatsapp_enviado);
  
  // Sort: late first, then by time since class (descending)
  const sortedItems = [...pendingItems].sort((a, b) => {
    const aLate = isLateFollowUp(a);
    const bLate = isLateFollowUp(b);
    
    if (aLate && !bLate) return -1;
    if (!aLate && bLate) return 1;
    
    const aHours = getTimeSinceClass(a).hours;
    const bHours = getTimeSinceClass(b).hours;
    return bHours - aHours;
  });

  const pendingCount = pendingItems.length;

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-500" />
              Follow Up Pós-Experimental
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm italic">
                    Follow up não é insistência. É fechar o ciclo de quem já te deu tempo.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-sm text-muted-foreground">
            Leads que compareceram mas não fecharam matrícula
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge 
            variant="outline" 
            className={cn(
              "text-sm font-medium",
              pendingCount >= 4 ? "border-red-500 text-red-600 bg-red-50" :
              pendingCount >= 1 ? "border-orange-500 text-orange-600 bg-orange-50" :
              "border-green-500 text-green-600 bg-green-50"
            )}
          >
            {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {sortedItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
            <p>Nenhum follow up pendente no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedItems.map((item) => {
              const timeSince = getTimeSinceClass(item);
              const isLate = isLateFollowUp(item);
              
              return (
                <div
                  key={item.lead.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all",
                    isLate 
                      ? "border-red-400 bg-red-50/50 dark:bg-red-950/20" 
                      : "border-border bg-card"
                  )}
                >
                  {isLate && (
                    <div className="flex items-center gap-2 mb-3 text-red-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-medium">⚠️ FOLLOW UP ATRASADO +48H</span>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground">{item.lead.nome?.toUpperCase()}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <WhatsAppLink phone={item.lead.telefone} className="text-sm" />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/lead/${item.lead.id}`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className={cn("flex items-center gap-1.5 text-sm mb-3", timeSince.color)}>
                    <Clock className="w-4 h-4" />
                    <span>⏱️ {timeSince.text}</span>
                  </div>
                  
                  {isLate && (
                    <p className="text-xs text-red-600 mb-3 bg-red-100/50 p-2 rounded">
                      Este lead está há mais de 48h sem follow up após a aula experimental. Prioridade máxima.
                    </p>
                  )}
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleSendFollowUp(item)}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      📲 Enviar Follow Up
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => handleMarkAsDone(item)}
                        disabled={loading}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Realizado
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleNotInterested(item)}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Não interessado
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Histórico de Follow-ups Concluídos */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className="mt-6">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between p-3 hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Histórico de Follow-ups Concluídos</span>
              </div>
              {historyOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {loadingHistory ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Carregando histórico...
              </div>
            ) : completedFollowUps.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Nenhum follow-up concluído ainda.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {completedFollowUps.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium text-sm truncate">{item.nome?.toUpperCase()}</h5>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            item.status_funil === 'convertido' 
                              ? "border-green-500 text-green-600 bg-green-50" 
                              : item.status_funil === 'perdido'
                              ? "border-red-500 text-red-600 bg-red-50"
                              : "border-muted"
                          )}
                        >
                          {item.status_funil === 'convertido' ? '✅ Convertido' : 
                           item.status_funil === 'perdido' ? '❌ Perdido' : 
                           item.status_funil}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {item.follow_up_enviado_em 
                              ? format(parseISO(item.follow_up_enviado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{item.follow_up_responsavel || 'Não informado'}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/lead/${item.id}`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {/* Confirm Follow Up Sent Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envio do Follow Up</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Você enviou a mensagem de follow up para <strong>{selectedItem?.lead.nome}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmSent} disabled={loading}>
              <CheckCircle className="w-4 h-4 mr-2" />
              ✅ Marcar mensagem como enviada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Follow Up Done Modal */}
      <Dialog open={confirmDoneModalOpen} onOpenChange={setConfirmDoneModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Follow Up Realizado</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Você já realizou o follow up com <strong>{selectedItem?.lead.nome}</strong>?
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Isso marcará o contato como concluído e removerá da lista de pendentes.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDoneModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmDone} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar Realizado
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
            <p className="text-sm text-muted-foreground mb-4">
              Selecione o motivo (opcional):
            </p>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {NOT_INTERESTED_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label htmlFor={reason.value}>{reason.label}</Label>
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
