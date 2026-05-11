import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Calendar, Clock, Save, RefreshCw, MessageCircle, Activity, User, UserX, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/errorMessages';
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

const TREINADORES = [
  'Guilherme',
  'Diogo', 
  'Luiz',
  'Ivan',
  'Andrey',
  'Lucas',
  'Rafael',
];

const FOLLOW_UP_MESSAGE = `Oi, {{nome}}! Tudo bem?

Queria saber como você se sentiu na IRON! Gostou do treino e do espaço?

A gente se dedica muito a criar um ambiente acolhedor e exclusivo, com acompanhamento de perto pra você treinar com tranquilidade e ter resultados de verdade.

Se você curtiu e quiser fazer parte do time, fico feliz em te ajudar com os próximos passos 😊`;

export function EventosHoje({ items, onRefresh, onReagendar }: EventosHojeProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [treinadores, setTreinadores] = useState<Record<string, string>>({});
  const [savedTreinador, setSavedTreinador] = useState<Record<string, boolean>>({});
  const [followUpDialogItem, setFollowUpDialogItem] = useState<EventoItem | null>(null);
  const [presencaDialogItem, setPresencaDialogItem] = useState<EventoItem | null>(null);
  const [naoCompareceuDialogItem, setNaoCompareceuDialogItem] = useState<EventoItem | null>(null);

  const handleMarcarPresenca = async (item: EventoItem, checked: boolean) => {
    const treinadorSelecionado = treinadores[item.interacao.id] || item.interacao.treinador_experimental;
    
    // Se está marcando presença e não selecionou treinador (para experimental)
    if (checked && item.tipoEvento === 'experimental' && !treinadorSelecionado) {
      toast({ title: 'Selecione o treinador que ministrou a aula', variant: 'destructive' });
      return;
    }
    
    setLoading(prev => ({ ...prev, [item.interacao.id]: true }));
    
    if (item.tipoEvento === 'experimental') {
      // Update interacao for experimental with trainer
      const { error: interacaoError } = await supabase
        .from('interacoes')
        .update({ 
          compareceu: checked,
          treinador_experimental: checked ? treinadorSelecionado : null
        })
        .eq('id', item.interacao.id);

      if (interacaoError) {
        toast({ title: 'Erro ao atualizar presença', description: getErrorMessage(interacaoError), variant: 'destructive' });
        setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
        return;
      }

      // Always persist trainer name on the lead when attendance is confirmed
      if (checked && treinadorSelecionado) {
        await supabase
          .from('leads')
          .update({ treinador_experimental: treinadorSelecionado } as any)
          .eq('id', item.lead.id);
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
        
        // Abrir modal de confirmação para enviar follow-up
        setFollowUpDialogItem(item);
        
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
        toast({ title: 'Erro ao atualizar status', description: getErrorMessage(error), variant: 'destructive' });
        setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
        return;
      }
      toast({ title: checked ? 'Avaliação realizada!' : 'Status atualizado!' });
    }
    
    onRefresh();
    setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
  };


  const getPrimeiroNome = (nomeCompleto: string): string => {
    return nomeCompleto.split(' ')[0];
  };

  const openFollowUpWhatsApp = (item: EventoItem) => {
    const phone = normalizePhoneForWhatsApp(item.lead.telefone || '');
    const primeiroNome = getPrimeiroNome(item.lead.nome);
    const message = FOLLOW_UP_MESSAGE.replace('{{nome}}', primeiroNome);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
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

  const handleConfirmFollowUp = () => {
    if (followUpDialogItem) {
      openFollowUpWhatsApp(followUpDialogItem);
      setFollowUpDialogItem(null);
    }
  };

  const handleNaoCompareceu = async (item: EventoItem) => {
    setLoading(prev => ({ ...prev, [item.interacao.id]: true }));
    try {
      if (item.tipoEvento === 'experimental') {
        const { error } = await supabase
          .from('interacoes')
          .update({ compareceu: false })
          .eq('id', item.interacao.id);
        if (error) throw error;
        // Atualiza status do lead para perdido por falta
        await supabase
          .from('leads')
          .update({ status_funil: 'perdido' })
          .eq('id', item.lead.id);
      } else {
        const { error } = await supabase
          .from('interacoes')
          .update({ status_avaliacao: 'faltou' })
          .eq('id', item.interacao.id);
        if (error) throw error;
      }
      toast({ title: 'Marcado como não compareceu' });
      onRefresh();
    } catch (error) {
      toast({ title: 'Erro ao atualizar', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
    }
  };

  return (
    <>
    <AlertDialog open={!!followUpDialogItem} onOpenChange={(open) => !open && setFollowUpDialogItem(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enviar mensagem de follow-up?</AlertDialogTitle>
          <AlertDialogDescription>
            Deseja abrir o WhatsApp com a mensagem de follow-up para {followUpDialogItem?.lead.nome.split(' ')[0]}?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Não enviar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmFollowUp}>
            <MessageCircle className="w-4 h-4 mr-2" />
            Abrir WhatsApp
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
                      <p className="font-medium">{item.lead.nome?.toUpperCase()}</p>
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

                {item.tipoEvento === 'experimental' && (() => {
                  const anamneseOk = !!anamneseMap[item.lead.id];
                  const lembrete = lembreteMap[item.lead.id];
                  const lembreteOk = !!lembrete;
                  return (
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
                          ? `Lembrete ${lembrete!.tipo} enviado às ${format(new Date(lembrete!.at as string), 'HH:mm', { locale: ptBR })}`
                          : 'Lembrete pendente'}
                      </Badge>
                    </div>
                  );
                })()}

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

                {item.tipoEvento === 'experimental' && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome do treinador"
                      value={treinadores[item.interacao.id] ?? item.interacao.treinador_experimental ?? ''}
                      onChange={(e) => setTreinadores(prev => ({ ...prev, [item.interacao.id]: e.target.value.toUpperCase() }))}
                      className="h-8 w-[160px] text-sm"
                      list={`treinadores-${item.interacao.id}`}
                    />
                    <datalist id={`treinadores-${item.interacao.id}`}>
                      {TREINADORES.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={loading[`treinador-${item.interacao.id}`]}
                      onClick={async () => {
                        const value = (treinadores[item.interacao.id] ?? item.interacao.treinador_experimental ?? '').trim().toUpperCase();
                        if (!value) {
                          toast({ title: 'Informe o nome do treinador', variant: 'destructive' });
                          return;
                        }
                        setLoading(prev => ({ ...prev, [`treinador-${item.interacao.id}`]: true }));
                        const { error } = await supabase
                          .from('interacoes')
                          .update({ treinador_experimental: value })
                          .eq('id', item.interacao.id);
                        if (error) {
                          toast({ title: 'Erro ao salvar treinador', description: getErrorMessage(error), variant: 'destructive' });
                        } else {
                          toast({ title: 'Treinador salvo!' });
                          onRefresh();
                        }
                        setLoading(prev => ({ ...prev, [`treinador-${item.interacao.id}`]: false }));
                      }}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={getPresencaChecked(item)}
                      onCheckedChange={(checked) => handleMarcarPresenca(item, checked)}
                      disabled={loading[item.interacao.id]}
                    />
                    <span className="text-sm">Marcar Presença</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Ações
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onReagendar(item)}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reagendar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleNaoCompareceu(item)}
                        className="text-destructive focus:text-destructive"
                      >
                        <UserX className="w-4 h-4 mr-2" />
                        Não Compareceu
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
