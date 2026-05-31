import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, 
  MessageSquare, 
  Building, 
  Dumbbell, 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  User,
  Award,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Interacao } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface InteractionTimelineProps {
  interacoes: Interacao[];
  onInteractionClick: (interacao: Interacao) => void;
}

const getInteractionIcon = (tipo: string) => {
  switch (tipo) {
    case 'Ligação':
      return { icon: Phone, color: 'bg-blue-500', textColor: 'text-blue-500' };
    case 'WhatsApp':
      return { icon: MessageSquare, color: 'bg-green-500', textColor: 'text-green-500' };
    case 'Presencial':
      return { icon: Building, color: 'bg-purple-500', textColor: 'text-purple-500' };
    case 'Avaliação Física':
      return { icon: ClipboardList, color: 'bg-amber-500', textColor: 'text-amber-500' };
    default:
      return { icon: User, color: 'bg-gray-500', textColor: 'text-gray-500' };
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function InteractionTimeline({ interacoes, onInteractionClick }: InteractionTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (interacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhuma interação registrada</p>
        <p className="text-sm">Adicione a primeira interação com este lead</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {interacoes.map((int, index) => {
          const { icon: Icon, color, textColor } = getInteractionIcon(int.tipo);
          const isExpanded = expandedIds.has(int.id);
          const hasLongDescription = int.descricao && int.descricao.length > 100;

          return (
            <div
              key={int.id}
              className="relative pl-14 cursor-pointer group"
              onClick={() => onInteractionClick(int)}
            >
              {/* Icon circle */}
              <div className={cn(
                "absolute left-3 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-transform group-hover:scale-110",
                color
              )}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>

              {/* Card */}
              <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-all group-hover:border-primary/50">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-semibold", textColor)}>{int.tipo}</span>
                    {int.fechou_matricula && (
                      <Badge className="bg-green-600 hover:bg-green-700 text-white">
                        <Award className="w-3 h-3 mr-1" />
                        Matriculou
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground" title={format(new Date(int.data_interacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}>
                      {formatDistanceToNow(new Date(int.data_interacao), { addSuffix: true, locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(int.data_interacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {int.tipo === 'Avaliação Física' ? (
                    <>
                      {int.status_avaliacao === 'agendada' && (
                        <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                          <Calendar className="w-3 h-3 mr-1" />
                          Agendada
                        </Badge>
                      )}
                      {int.status_avaliacao === 'realizada' && (
                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Realizada
                        </Badge>
                      )}
                      {int.status_avaliacao === 'faltou' && (
                        <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50">
                          <XCircle className="w-3 h-3 mr-1" />
                          Faltou
                        </Badge>
                      )}
                      {int.status_avaliacao === 'reagendada' && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">
                          <Calendar className="w-3 h-3 mr-1" />
                          Reagendada
                        </Badge>
                      )}
                    </>
                  ) : (
                    <>
                      {int.agendou_experimental && (
                        <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                          <Calendar className="w-3 h-3 mr-1" />
                          Agendou Exp.
                        </Badge>
                      )}
                      {int.compareceu && (
                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Compareceu
                        </Badge>
                      )}
                      {int.compareceu === false && int.data_experimental && (
                        <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50">
                          <XCircle className="w-3 h-3 mr-1" />
                          Faltou
                        </Badge>
                      )}
                      {int.reagendou && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">
                          <Calendar className="w-3 h-3 mr-1" />
                          Reagendou
                        </Badge>
                      )}
                    </>
                  )}
                </div>

                {/* Description */}
                {int.descricao && (
                  <div className="mb-2">
                    <p className={cn(
                      "text-sm text-muted-foreground",
                      !isExpanded && hasLongDescription && "line-clamp-2"
                    )}>
                      {int.descricao}
                    </p>
                    {hasLongDescription && (
                      <button
                        onClick={(e) => toggleExpand(int.id, e)}
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                      >
                        {isExpanded ? (
                          <>Ver menos <ChevronUp className="w-3 h-3" /></>
                        ) : (
                          <>Ver mais <ChevronDown className="w-3 h-3" /></>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {int.atendido_por && (
                    <div>
                      <span className="text-muted-foreground">Atendido por: </span>
                      <span className="font-medium">{int.atendido_por.toUpperCase()}</span>
                    </div>
                  )}
                  {int.data_experimental && (
                    <div>
                      <span className="text-muted-foreground">Experimental: </span>
                      <span className="font-medium">
                        {(() => {
                          const [y, m, d] = int.data_experimental.split('-').map(Number);
                          return format(new Date(y, m - 1, d), 'dd/MM/yyyy', { locale: ptBR });
                        })()}
                        {int.hora_experimental && ` às ${int.hora_experimental.slice(0, 5)}`}
                      </span>
                    </div>
                  )}
                  {int.tipo === 'Avaliação Física' && int.data_avaliacao && (
                    <div>
                      <span className="text-muted-foreground">Avaliação: </span>
                      <span className="font-medium">
                        {format(new Date(int.data_avaliacao), 'dd/MM/yyyy', { locale: ptBR })}
                        {int.hora_avaliacao && ` às ${int.hora_avaliacao}`}
                      </span>
                    </div>
                  )}
                  {int.treinador_experimental && (
                    <div>
                      <span className="text-muted-foreground">Treinador (Experimental): </span>
                      <span className="font-medium">{int.treinador_experimental}</span>
                    </div>
                  )}
                  {int.compareceu === true && (
                    <div>
                      <span className="text-muted-foreground">Presença: </span>
                      <span className="font-medium text-green-600">✓ Compareceu</span>
                    </div>
                  )}
                  {int.treinador_responsavel && (
                    <div>
                      <span className="text-muted-foreground">Treinador: </span>
                      <span className="font-medium">{int.treinador_responsavel}</span>
                    </div>
                  )}
                  {int.responsavel_fechamento && (
                    <div>
                      <span className="text-muted-foreground">Fechamento: </span>
                      <span className="font-medium">{int.responsavel_fechamento}</span>
                    </div>
                  )}
                  {int.plano_escolhido && (
                    <div>
                      <span className="text-muted-foreground">Plano: </span>
                      <span className="font-medium">{int.plano_escolhido}</span>
                    </div>
                  )}
                  {int.valor_plano > 0 && (
                    <div>
                      <span className="text-muted-foreground">Valor: </span>
                      <span className="font-medium text-green-600">{formatCurrency(int.valor_plano)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
