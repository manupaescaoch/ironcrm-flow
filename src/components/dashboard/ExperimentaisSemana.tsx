import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { Calendar, Clock, RefreshCw, Check, X, ChevronDown, ChevronUp, GraduationCap, RotateCcw } from 'lucide-react';
import { Lead, Interacao } from '@/types/database';
import { format, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ExperimentalItem {
  lead: Lead;
  interacao: Interacao;
}

interface ExperimentaisSemanaProps {
  items: ExperimentalItem[];
  onReagendar: (item: ExperimentalItem) => void;
  onRefresh: () => void;
  startDate: Date;
  endDate: Date;
}

export function ExperimentaisSemana({ items, onReagendar, onRefresh, startDate, endDate }: ExperimentaisSemanaProps) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Group by date
  const groupedByDate = items.reduce((acc, item) => {
    const dateStr = item.interacao.data_experimental || '';
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(item);
    return acc;
  }, {} as Record<string, ExperimentalItem[]>);

  // Sort dates
  const sortedDates = Object.keys(groupedByDate).sort();

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleCompareceu = async (item: ExperimentalItem, value: boolean) => {
    setLoading(prev => ({ ...prev, [item.interacao.id]: true }));
    
    // Update interacao
    const { error: interacaoError } = await supabase
      .from('interacoes')
      .update({ compareceu: value })
      .eq('id', item.interacao.id);

    if (interacaoError) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
      return;
    }

    // If marking as attended and hasn't closed matricula, update lead status to follow_up
    if (value && !item.interacao.fechou_matricula) {
      const { error: leadError } = await supabase
        .from('leads')
        .update({ status_funil: 'follow_up' })
        .eq('id', item.lead.id);

      if (leadError) {
        console.error('Erro ao atualizar status do lead:', leadError);
      }
      toast({ title: 'Presença confirmada! Lead movido para Follow Up.' });
    } else {
      toast({ title: value ? 'Presença confirmada!' : 'Presença removida' });
    }

    onRefresh();
    setLoading(prev => ({ ...prev, [item.interacao.id]: false }));
  };

  const getStatusBadge = (item: ExperimentalItem) => {
    const itemDate = item.interacao.data_experimental ? parseISO(item.interacao.data_experimental) : null;
    const isToday = itemDate && isSameDay(itemDate, new Date());
    const isPast = itemDate && itemDate < new Date() && !isToday;

    if (item.interacao.compareceu === true) {
      return <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" />Compareceu</Badge>;
    }
    if (item.interacao.compareceu === false || (isPast && item.interacao.compareceu === null)) {
      return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Não compareceu</Badge>;
    }
    if (item.interacao.confirmado === true) {
      return <Badge className="bg-sky-500">Confirmado</Badge>;
    }
    if (isToday) {
      return <Badge className="bg-orange-500">Hoje - Aguardando</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Experimentais do Período
        </CardTitle>
        <Badge variant="secondary">{items.length} total</Badge>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhuma aula experimental no período selecionado
          </p>
        ) : (
          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
            {sortedDates.map((dateStr) => {
              const dateItems = groupedByDate[dateStr];
              const parsedDate = parseISO(dateStr);
              const isToday = isSameDay(parsedDate, new Date());
              
              return (
                <div key={dateStr} className="space-y-2">
                  <div className={`flex items-center gap-2 sticky top-0 py-2 ${isToday ? 'bg-primary/10' : 'bg-background'}`}>
                    <h3 className={`font-semibold ${isToday ? 'text-primary' : ''}`}>
                      {format(parsedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      {isToday && <span className="ml-2 text-sm">(Hoje)</span>}
                    </h3>
                    <Badge variant="outline">{dateItems.length}</Badge>
                  </div>
                  
                  <div className="space-y-2 pl-2 border-l-2 border-muted">
                    {dateItems
                      .sort((a, b) => (a.interacao.hora_experimental || '').localeCompare(b.interacao.hora_experimental || ''))
                      .map((item) => {
                        const isExpanded = expandedItems[item.interacao.id];
                        
                        return (
                          <div
                            key={item.interacao.id}
                            className="bg-muted/50 rounded-lg overflow-hidden"
                          >
                            <div className="p-3 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground shrink-0">
                                  <Clock className="w-4 h-4" />
                                  {item.interacao.hora_experimental || '--:--'}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{item.lead.nome}</p>
                                  <WhatsAppLink phone={item.lead.telefone || ''} className="text-sm" />
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Status badges */}
                                <div className="flex items-center gap-1">
                                  {item.interacao.fechou_matricula && (
                                    <Badge className="bg-emerald-600">
                                      <GraduationCap className="w-3 h-3 mr-1" />
                                      Matriculou
                                    </Badge>
                                  )}
                                  {item.interacao.reagendou && (
                                    <Badge className="bg-amber-500">
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                      Reagendou
                                    </Badge>
                                  )}
                                  {getStatusBadge(item)}
                                </div>
                                
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleExpanded(item.interacao.id)}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              </div>
                            </div>
                            
                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="px-3 pb-3 pt-0 border-t border-muted space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Status Funil:</span>
                                    <p className="font-medium">{item.lead.status_funil}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Origem:</span>
                                    <p className="font-medium">{item.lead.origem || '-'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Confirmado:</span>
                                    <p className="font-medium">{item.interacao.confirmado ? 'Sim' : 'Não'}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Cadastrado por:</span>
                                    <p className="font-medium">{item.lead.cadastrado_por || '-'}</p>
                                  </div>
                                </div>
                                
                                {item.interacao.descricao && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Observações:</span>
                                    <p className="font-medium">{item.interacao.descricao}</p>
                                  </div>
                                )}
                                
                                {item.interacao.fechou_matricula && (
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm bg-emerald-500/10 p-2 rounded">
                                    <div>
                                      <span className="text-muted-foreground">Plano:</span>
                                      <p className="font-medium">{item.interacao.plano_escolhido || '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Valor:</span>
                                      <p className="font-medium">
                                        {item.interacao.valor_plano 
                                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.interacao.valor_plano)
                                          : '-'}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Resp. Fechamento:</span>
                                      <p className="font-medium">{item.interacao.responsavel_fechamento || '-'}</p>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Admin controls */}
                                {isAdmin && (
                                  <div className="flex items-center justify-between pt-2 border-t border-muted">
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={item.interacao.compareceu || false}
                                          onCheckedChange={(value) => handleToggleCompareceu(item, value)}
                                          disabled={loading[item.interacao.id]}
                                        />
                                        <span className="text-sm font-medium">Compareceu</span>
                                      </div>
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
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
