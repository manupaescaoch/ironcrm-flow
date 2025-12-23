import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WhatsAppLink, normalizePhoneForWhatsApp } from '@/components/WhatsAppLink';
import { AlertCircle, Clock, RefreshCw, Calendar, Activity, Zap, MessageCircle, X } from 'lucide-react';
import { Lead, Interacao } from '@/types/database';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EventoItem } from './EventosHoje';
import { FollowUpAutoItem } from './AutoFollowUpCard';

type FilterType = 'all' | 'confirmar' | 'presenca' | 'followup';

interface PendenciasDiaProps {
  pendenciasHoje: EventoItem[];
  pendenciasAmanha: EventoItem[];
  followUpsHoje?: FollowUpAutoItem[];
  onReagendar: (item: EventoItem) => void;
  onFollowUpClick?: (item: FollowUpAutoItem) => void;
}

export function PendenciasDia({ pendenciasHoje, pendenciasAmanha, followUpsHoje = [], onReagendar, onFollowUpClick }: PendenciasDiaProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const totalPendencias = pendenciasHoje.length + pendenciasAmanha.length + followUpsHoje.length;

  const getHoraEvento = (item: EventoItem): string => {
    if (item.tipoEvento === 'avaliacao') {
      return item.interacao.hora_avaliacao || '--:--';
    }
    return item.interacao.hora_experimental || '--:--';
  };

  const getDataEvento = (item: EventoItem): string => {
    const dataEvento = item.tipoEvento === 'avaliacao' 
      ? item.interacao.data_avaliacao 
      : item.interacao.data_experimental;
    
    if (!dataEvento) return '-';
    return format(new Date(dataEvento), "dd/MM", { locale: ptBR });
  };

  const handleFilterClick = (filter: FilterType) => {
    setActiveFilter(prev => prev === filter ? 'all' : filter);
  };

  const showConfirmar = activeFilter === 'all' || activeFilter === 'confirmar';
  const showPresenca = activeFilter === 'all' || activeFilter === 'presenca';
  const showFollowup = activeFilter === 'all' || activeFilter === 'followup';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Pendências do Dia
          </CardTitle>
          <Badge variant={totalPendencias > 0 ? 'destructive' : 'secondary'}>
            {totalPendencias}
          </Badge>
        </div>
        {totalPendencias > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {pendenciasAmanha.length > 0 && (
              <Badge 
                variant="outline" 
                className={`cursor-pointer transition-all text-xs ${
                  activeFilter === 'confirmar' 
                    ? 'bg-orange-500 text-white border-orange-500 ring-2 ring-orange-300' 
                    : 'bg-orange-500/10 text-orange-600 border-orange-300 hover:bg-orange-500/20'
                }`}
                onClick={() => handleFilterClick('confirmar')}
              >
                🔔 Confirmar: {pendenciasAmanha.length}
                {activeFilter === 'confirmar' && <X className="w-3 h-3 ml-1" />}
              </Badge>
            )}
            {pendenciasHoje.length > 0 && (
              <Badge 
                variant="outline" 
                className={`cursor-pointer transition-all text-xs ${
                  activeFilter === 'presenca' 
                    ? 'bg-destructive text-white border-destructive ring-2 ring-destructive/30' 
                    : 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20'
                }`}
                onClick={() => handleFilterClick('presenca')}
              >
                Presença: {pendenciasHoje.length}
                {activeFilter === 'presenca' && <X className="w-3 h-3 ml-1" />}
              </Badge>
            )}
            {followUpsHoje.length > 0 && (
              <Badge 
                variant="outline" 
                className={`cursor-pointer transition-all text-xs ${
                  activeFilter === 'followup' 
                    ? 'bg-emerald-500 text-white border-emerald-500 ring-2 ring-emerald-300' 
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-300 hover:bg-emerald-500/20'
                }`}
                onClick={() => handleFilterClick('followup')}
              >
                Follow-up: {followUpsHoje.length}
                {activeFilter === 'followup' && <X className="w-3 h-3 ml-1" />}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {totalPendencias === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma pendência no momento
          </p>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {/* 1º PRIORIDADE: Pendências de Amanhã (Confirmação de Experimental) */}
            {showConfirmar && pendenciasAmanha.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500 hover:bg-orange-600">
                    🔔 Confirmar Experimental
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
                        <p className="font-medium">{item.lead.nome?.toUpperCase()}</p>
                        <WhatsAppLink phone={item.lead.telefone || ''} className="text-sm" />
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {getHoraEvento(item)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getDataEvento(item)}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={item.tipoEvento === 'avaliacao' 
                            ? 'mt-1 bg-teal-100 text-teal-700 border-teal-300 text-xs' 
                            : 'mt-1 bg-purple-100 text-purple-700 border-purple-300 text-xs'
                          }
                        >
                          {item.tipoEvento === 'avaliacao' ? (
                            <><Activity className="w-3 h-3 mr-1" /> Aval.</>
                          ) : (
                            <><Calendar className="w-3 h-3 mr-1" /> Exp.</>
                          )}
                        </Badge>
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

            {/* 2º PRIORIDADE: Pendências de Hoje (sem marcar presença) */}
            {showPresenca && pendenciasHoje.length > 0 && (
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
                        <p className="font-medium">{item.lead.nome?.toUpperCase()}</p>
                        <WhatsAppLink phone={item.lead.telefone || ''} className="text-sm" />
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {getHoraEvento(item)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getDataEvento(item)}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={item.tipoEvento === 'avaliacao' 
                            ? 'mt-1 bg-teal-100 text-teal-700 border-teal-300 text-xs' 
                            : 'mt-1 bg-purple-100 text-purple-700 border-purple-300 text-xs'
                          }
                        >
                          {item.tipoEvento === 'avaliacao' ? (
                            <><Activity className="w-3 h-3 mr-1" /> Aval.</>
                          ) : (
                            <><Calendar className="w-3 h-3 mr-1" /> Exp.</>
                          )}
                        </Badge>
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

            {/* 3º PRIORIDADE: Follow-ups do Dia (D+1, D+7, etc.) */}
            {showFollowup && followUpsHoje.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500 hover:bg-emerald-600">
                    <Zap className="w-3 h-3 mr-1" />
                    Follow-ups do Dia
                  </Badge>
                  <span className="text-sm text-muted-foreground">({followUpsHoje.length})</span>
                </div>
                {followUpsHoje.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={
                            item.tipo === 'D+1' 
                              ? 'bg-emerald-100 text-emerald-700 text-xs' 
                              : 'bg-blue-100 text-blue-700 text-xs'
                          }>
                            {item.tipo}
                          </Badge>
                        </div>
                        <p className="font-medium">{item.lead.nome?.toUpperCase()}</p>
                        <WhatsAppLink phone={item.lead.telefone || ''} className="text-sm" />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Ref: {format(parseISO(item.data_referencia), "dd/MM", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    {onFollowUpClick && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => onFollowUpClick(item)}
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          WhatsApp
                        </Button>
                      </div>
                    )}
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
