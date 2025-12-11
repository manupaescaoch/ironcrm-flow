import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { Lead, Interacao } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExperimentalItem {
  lead: Lead;
  interacao: Interacao;
}

interface PendenciasDiaProps {
  pendenciasHoje: ExperimentalItem[];
  pendenciasAmanha: ExperimentalItem[];
  onReagendar: (item: ExperimentalItem) => void;
}

export function PendenciasDia({ pendenciasHoje, pendenciasAmanha, onReagendar }: PendenciasDiaProps) {
  const totalPendencias = pendenciasHoje.length + pendenciasAmanha.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          Pendências do Dia
        </CardTitle>
        <Badge variant={totalPendencias > 0 ? 'destructive' : 'secondary'}>
          {totalPendencias}
        </Badge>
      </CardHeader>
      <CardContent>
        {totalPendencias === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma pendência no momento
          </p>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {/* Pendências de Hoje */}
            {pendenciasHoje.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Hoje — sem marcar presença</Badge>
                  <span className="text-sm text-muted-foreground">({pendenciasHoje.length})</span>
                </div>
                {pendenciasHoje.map((item) => (
                  <div
                    key={item.interacao.id}
                    className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{item.lead.nome}</p>
                        <WhatsAppLink phone={item.lead.telefone || ''} className="text-sm" />
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {item.interacao.hora_experimental || '--:--'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.interacao.data_experimental 
                            ? format(new Date(item.interacao.data_experimental), "dd/MM", { locale: ptBR })
                            : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
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

            {/* Pendências de Amanhã */}
            {pendenciasAmanha.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500 hover:bg-orange-600">
                    Amanhã — ainda não confirmado
                  </Badge>
                  <span className="text-sm text-muted-foreground">({pendenciasAmanha.length})</span>
                </div>
                {pendenciasAmanha.map((item) => (
                  <div
                    key={item.interacao.id}
                    className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{item.lead.nome}</p>
                        <WhatsAppLink phone={item.lead.telefone || ''} className="text-sm" />
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {item.interacao.hora_experimental || '--:--'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.interacao.data_experimental 
                            ? format(new Date(item.interacao.data_experimental), "dd/MM", { locale: ptBR })
                            : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
