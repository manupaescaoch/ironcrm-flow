import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { Calendar, Clock, RefreshCw, Check, X } from 'lucide-react';
import { Lead, Interacao } from '@/types/database';
import { format, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExperimentalItem {
  lead: Lead;
  interacao: Interacao;
}

interface ExperimentaisSemanaProps {
  items: ExperimentalItem[];
  onReagendar: (item: ExperimentalItem) => void;
  startDate: Date;
  endDate: Date;
}

export function ExperimentaisSemana({ items, onReagendar, startDate, endDate }: ExperimentaisSemanaProps) {
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
                      .map((item) => (
                        <div
                          key={item.interacao.id}
                          className="p-3 bg-muted/50 rounded-lg flex items-center justify-between gap-4"
                        >
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
                            {getStatusBadge(item)}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onReagendar(item)}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
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
