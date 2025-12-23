import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, AlertTriangle, Clock, XCircle, CheckCircle, Info, Phone, Eye, CalendarDays, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { normalizePhoneForWhatsApp } from '@/components/WhatsAppLink';
import { useNavigate } from 'react-router-dom';

export interface FollowUpAutoItem {
  id: string;
  lead_id: string;
  tipo: 'D+1' | 'D+7' | 'D+15' | 'D+30';
  data_referencia: string;
  data_prevista: string;
  status: 'pendente' | 'concluido' | 'cancelado';
  concluido_por: string | null;
  concluido_em: string | null;
  lead: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
    status_funil: string;
  };
}

interface AutoFollowUpCardProps {
  items: FollowUpAutoItem[];
  onRefresh: () => void;
}

// Mensagens prontas por estágio
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

const TIPO_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  'D+1': { label: 'D+1', color: 'text-green-700', bgColor: 'bg-green-100' },
  'D+7': { label: 'D+7', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'D+15': { label: 'D+15', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  'D+30': { label: 'D+30', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export function AutoFollowUpCard({ items, onRefresh }: AutoFollowUpCardProps) {
  const navigate = useNavigate();
  const { userName } = useAuth();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [notInterestedModalOpen, setNotInterestedModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FollowUpAutoItem | null>(null);
  const [selectedReason, setSelectedReason] = useState('preco');
  const [loading, setLoading] = useState(false);

  const getTimeInfo = (item: FollowUpAutoItem) => {
    try {
      const dataPrevista = parseISO(item.data_prevista);
      const hoje = new Date();
      const diasAtraso = differenceInDays(hoje, dataPrevista);
      
      if (diasAtraso > 0) {
        return { 
          text: `${diasAtraso} dia${diasAtraso > 1 ? 's' : ''} atrasado`, 
          color: 'text-red-600',
          isLate: true 
        };
      } else if (diasAtraso === 0) {
        return { text: 'Vence hoje', color: 'text-orange-600', isLate: false };
      } else {
        return { 
          text: `Em ${Math.abs(diasAtraso)} dia${Math.abs(diasAtraso) > 1 ? 's' : ''}`, 
          color: 'text-muted-foreground',
          isLate: false 
        };
      }
    } catch {
      return { text: '-', color: 'text-muted-foreground', isLate: false };
    }
  };

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
      // Marcar follow-up como concluído
      const { error } = await supabase
        .from('follow_ups')
        .update({
          status: 'concluido',
          concluido_por: userName || 'Sistema',
          concluido_em: new Date().toISOString(),
        })
        .eq('id', selectedItem.id);

      if (error) throw error;
      
      // Criar interação de registro
      await supabase
        .from('interacoes')
        .insert({
          lead_id: selectedItem.lead_id,
          tipo: 'Follow Up',
          descricao: `Follow-up ${selectedItem.tipo} realizado via WhatsApp`,
          data_interacao: new Date().toISOString(),
          atendido_por: userName || 'Sistema',
        });
      
      toast.success(`Follow-up ${selectedItem.tipo} marcado como concluído!`);
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
      // Atualizar status do lead
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status_funil: 'perdido' })
        .eq('id', selectedItem.lead_id);

      if (leadError) throw leadError;

      // Cancelar todos os follow-ups pendentes do lead
      await supabase
        .from('follow_ups')
        .update({ status: 'cancelado' })
        .eq('lead_id', selectedItem.lead_id)
        .eq('status', 'pendente');

      // Criar interação de encerramento
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

  // Ordenar: D+1 primeiro, depois atrasados, depois por data prevista
  const sortedItems = [...items].sort((a, b) => {
    const aInfo = getTimeInfo(a);
    const bInfo = getTimeInfo(b);
    
    // D+1 sempre primeiro (prioridade máxima)
    if (a.tipo === 'D+1' && b.tipo !== 'D+1') return -1;
    if (a.tipo !== 'D+1' && b.tipo === 'D+1') return 1;
    
    // Depois os atrasados
    if (aInfo.isLate && !bInfo.isLate) return -1;
    if (!aInfo.isLate && bInfo.isLate) return 1;
    
    return new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime();
  });

  const lateCount = items.filter(i => getTimeInfo(i).isLate).length;
  const d1Count = items.filter(i => i.tipo === 'D+1').length;

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-500" />
              Follow-Ups Automáticos
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Follow-ups automáticos em D+1, D+7, D+15 e D+30 após a aula experimental.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-sm text-muted-foreground">
            Mensagens prontas por estágio - clique para enviar via WhatsApp
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {d1Count > 0 && (
            <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 animate-pulse">
              <Zap className="w-3 h-3 mr-1" />
              {d1Count} D+1 prioritário{d1Count !== 1 ? 's' : ''}
            </Badge>
          )}
          {lateCount > 0 && (
            <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50">
              {lateCount} atrasado{lateCount !== 1 ? 's' : ''}
            </Badge>
          )}
          <Badge 
            variant="outline" 
            className={cn(
              "text-sm font-medium",
              items.length >= 4 ? "border-red-500 text-red-600 bg-red-50" :
              items.length >= 1 ? "border-orange-500 text-orange-600 bg-orange-50" :
              "border-green-500 text-green-600 bg-green-50"
            )}
          >
            {items.length} pendente{items.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {sortedItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
            <p>Nenhum follow-up automático pendente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedItems.map((item) => {
              const timeInfo = getTimeInfo(item);
              const tipoInfo = TIPO_LABELS[item.tipo];
              
              const isD1 = item.tipo === 'D+1';
              
              return (
                <div
                  key={item.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all relative",
                    isD1 && !timeInfo.isLate
                      ? "border-emerald-400 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 ring-2 ring-emerald-200 dark:ring-emerald-800"
                      : timeInfo.isLate 
                        ? "border-red-400 bg-red-50/50 dark:bg-red-950/20" 
                        : "border-border bg-card"
                  )}
                >
                  {isD1 && !timeInfo.isLate && (
                    <div className="absolute -top-2 -right-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                        <Zap className="w-3 h-3" />
                      </span>
                    </div>
                  )}
                  
                  {isD1 && !timeInfo.isLate && (
                    <div className="flex items-center gap-2 mb-3 text-emerald-600">
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wide">⚡ PRIORIDADE MÁXIMA</span>
                    </div>
                  )}
                  
                  {timeInfo.isLate && (
                    <div className="flex items-center gap-2 mb-3 text-red-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-medium">⚠️ FOLLOW UP ATRASADO</span>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn(tipoInfo.bgColor, tipoInfo.color, "text-xs font-bold")}>
                          {tipoInfo.label}
                        </Badge>
                        <span className={cn("text-xs", timeInfo.color)}>
                          {timeInfo.text}
                        </span>
                      </div>
                      <h4 className="font-semibold text-foreground">{item.lead.nome?.toUpperCase()}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{item.lead.telefone || '-'}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/lead/${item.lead_id}`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-3">
                    <span>Referência: {format(parseISO(item.data_referencia), 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleSendWhatsApp(item)}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      📲 Enviar WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleNotInterested(item)}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      🚫 Não interessado
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Confirm Follow Up Sent Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envio do Follow-Up {selectedItem?.tipo}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Você enviou a mensagem de follow-up para <strong>{selectedItem?.lead.nome}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmSent} disabled={loading}>
              <CheckCircle className="w-4 h-4 mr-2" />
              ✅ Confirmar envio
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
              Selecione o motivo:
            </p>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {NOT_INTERESTED_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={`auto-${reason.value}`} />
                  <Label htmlFor={`auto-${reason.value}`}>{reason.label}</Label>
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
