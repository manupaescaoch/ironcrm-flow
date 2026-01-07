import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Loader2, Target, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface FollowUpStats {
  tipo: string;
  total: number;
  concluidos: number;
  cancelados: number;
  pendentes: number;
  conversoes: number;
  taxaConversao: number;
}

interface CompactRelatorioFollowUpsProps {
  onTipoClick?: (tipo: string) => void;
  refreshKey?: number;
  activeTipo?: string | null;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bgColor: string; progressColor: string }> = {
  'D+1': { label: 'D+1', color: 'text-emerald-700', bgColor: 'bg-emerald-100', progressColor: 'bg-emerald-500' },
  'D+7': { label: 'D+7', color: 'text-blue-700', bgColor: 'bg-blue-100', progressColor: 'bg-blue-500' },
  'D+15': { label: 'D+15', color: 'text-amber-700', bgColor: 'bg-amber-100', progressColor: 'bg-amber-500' },
  'D+30': { label: 'D+30', color: 'text-red-700', bgColor: 'bg-red-100', progressColor: 'bg-red-500' },
};

export function CompactRelatorioFollowUps({ onTipoClick, refreshKey, activeTipo }: CompactRelatorioFollowUpsProps) {
  const [stats, setStats] = useState<FollowUpStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ total: 0, concluidos: 0, conversoes: 0, taxaGeral: 0 });
  const { unidadeAtual } = useUnidade();

  useEffect(() => {
    fetchStats();
  }, [unidadeAtual?.id, refreshKey]);

  const fetchStats = async () => {
    setLoading(true);

    let query = supabase
      .from('follow_ups')
      .select(`
        id,
        tipo,
        status,
        lead_id,
        leads!inner(status_funil)
      `);

    if (unidadeAtual?.id) {
      query = query.eq('unidade_id', unidadeAtual.id);
    }

    const { data: followUps, error } = await query;

    if (error) {
      console.error('Error fetching follow-ups:', error);
      setLoading(false);
      return;
    }

    const tipos = ['D+1', 'D+7', 'D+15', 'D+30'];
    const statsMap: Record<string, FollowUpStats> = {};

    tipos.forEach(tipo => {
      statsMap[tipo] = {
        tipo,
        total: 0,
        concluidos: 0,
        cancelados: 0,
        pendentes: 0,
        conversoes: 0,
        taxaConversao: 0,
      };
    });

    followUps?.forEach((fu: any) => {
      const tipo = fu.tipo;
      if (!statsMap[tipo]) return;
      
      const leadStatus = fu.leads?.status_funil;
      const isLeadFinalizado = ['convertido', 'perdido'].includes(leadStatus);

      statsMap[tipo].total++;
      
      if (fu.status === 'concluido') {
        statsMap[tipo].concluidos++;
        if (leadStatus === 'convertido') {
          statsMap[tipo].conversoes++;
        }
      } else if (fu.status === 'cancelado') {
        statsMap[tipo].cancelados++;
      } else {
        if (!isLeadFinalizado) {
          statsMap[tipo].pendentes++;
        } else {
          statsMap[tipo].cancelados++;
        }
      }
    });

    const processedStats = tipos.map(tipo => {
      const stat = statsMap[tipo];
      stat.taxaConversao = stat.concluidos > 0 
        ? Math.round((stat.conversoes / stat.concluidos) * 100) 
        : 0;
      return stat;
    });

    const totalGeral = processedStats.reduce((acc, s) => acc + s.total, 0);
    const concluidosGeral = processedStats.reduce((acc, s) => acc + s.concluidos, 0);
    const conversoesGeral = processedStats.reduce((acc, s) => acc + s.conversoes, 0);
    const taxaGeral = concluidosGeral > 0 
      ? Math.round((conversoesGeral / concluidosGeral) * 100) 
      : 0;

    setStats(processedStats);
    setTotals({ 
      total: totalGeral, 
      concluidos: concluidosGeral, 
      conversoes: conversoesGeral, 
      taxaGeral 
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Relatório de Follow-ups
          </CardTitle>
          <Badge variant="outline" className="text-xs font-normal">
            Taxa: {totals.taxaGeral}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary inline */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
          <span>Total: <strong className="text-foreground">{totals.total}</strong></span>
          <span>Concluídos: <strong className="text-primary">{totals.concluidos}</strong></span>
          <span>Conversões: <strong className="text-green-600">{totals.conversoes}</strong></span>
        </div>

        {/* Compact stats by type */}
        <div className="space-y-2">
          {stats.map((stat) => {
            const config = TIPO_CONFIG[stat.tipo];
            const isActive = activeTipo === stat.tipo;
            const hasClickable = onTipoClick && stat.pendentes > 0;
            
            return (
              <div 
                key={stat.tipo} 
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md transition-colors",
                  hasClickable && "cursor-pointer hover:bg-muted/60",
                  isActive && "bg-primary/10 ring-1 ring-primary/30"
                )}
                onClick={() => hasClickable && onTipoClick(stat.tipo)}
              >
                {/* Type badge */}
                <Badge className={cn(config.bgColor, config.color, "text-xs font-bold min-w-[42px] justify-center")}>
                  {config.label}
                </Badge>
                
                {/* Progress bar */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={stat.taxaConversao} 
                      className="h-2 flex-1"
                    />
                    <span className={cn(
                      "text-xs font-medium w-8 text-right",
                      stat.taxaConversao >= 30 ? 'text-green-600' : 
                      stat.taxaConversao > 0 ? 'text-amber-600' : 'text-muted-foreground'
                    )}>
                      {stat.taxaConversao}%
                    </span>
                  </div>
                </div>
                
                {/* Mini stats */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5" title="Concluídos">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    {stat.concluidos}
                  </span>
                  <span className={cn(
                    "flex items-center gap-0.5",
                    stat.pendentes > 0 && hasClickable && "text-primary font-medium"
                  )} title="Pendentes">
                    <Clock className="w-3 h-3 text-amber-600" />
                    {stat.pendentes}
                  </span>
                  <span className="flex items-center gap-0.5" title="Cancelados">
                    <XCircle className="w-3 h-3 text-red-600" />
                    {stat.cancelados}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
