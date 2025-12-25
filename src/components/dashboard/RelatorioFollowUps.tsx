import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Loader2, TrendingUp, TrendingDown, Target, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface FollowUpStats {
  tipo: string;
  total: number;
  concluidos: number;
  cancelados: number;
  pendentes: number;
  conversoes: number;
  taxaConversao: number;
}

interface RelatorioFollowUpsProps {
  onTipoClick?: (tipo: string) => void;
}

const TIPO_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'D+1': { label: 'D+1', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  'D+7': { label: 'D+7', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'D+15': { label: 'D+15', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  'D+30': { label: 'D+30', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export function RelatorioFollowUps({ onTipoClick }: RelatorioFollowUpsProps) {
  const [stats, setStats] = useState<FollowUpStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ total: 0, concluidos: 0, conversoes: 0, taxaGeral: 0 });
  const { unidadeAtual } = useUnidade();

  useEffect(() => {
    fetchStats();
  }, [unidadeAtual?.id]);

  const fetchStats = async () => {
    setLoading(true);

    // Fetch all follow-ups with lead info
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

    // Process stats by type
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
      
      // Excluir leads convertidos ou perdidos da contagem de pendentes
      const leadStatus = fu.leads?.status_funil;
      const isLeadFinalizado = ['convertido', 'perdido'].includes(leadStatus);

      statsMap[tipo].total++;
      
      if (fu.status === 'concluido') {
        statsMap[tipo].concluidos++;
        // Check if lead converted
        if (leadStatus === 'convertido') {
          statsMap[tipo].conversoes++;
        }
      } else if (fu.status === 'cancelado') {
        statsMap[tipo].cancelados++;
      } else {
        // Só conta como pendente se o lead não estiver convertido/perdido
        if (!isLeadFinalizado) {
          statsMap[tipo].pendentes++;
        } else {
          // Lead convertido/perdido com follow-up pendente = considerar cancelado
          statsMap[tipo].cancelados++;
        }
      }
    });

    // Calculate conversion rates
    const processedStats = tipos.map(tipo => {
      const stat = statsMap[tipo];
      stat.taxaConversao = stat.concluidos > 0 
        ? Math.round((stat.conversoes / stat.concluidos) * 100) 
        : 0;
      return stat;
    });

    // Calculate totals
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
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Relatório de Follow-ups
          </CardTitle>
          <Badge variant="outline" className="font-normal">
            Taxa geral: {totals.taxaGeral}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{totals.total}</div>
            <div className="text-xs text-muted-foreground">Total Gerados</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{totals.concluidos}</div>
            <div className="text-xs text-muted-foreground">Concluídos</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{totals.conversoes}</div>
            <div className="text-xs text-muted-foreground">Conversões</div>
          </div>
        </div>

        {/* Stats by Type */}
        <div className="space-y-3">
          {stats.map((stat) => {
            const config = TIPO_CONFIG[stat.tipo] || { label: stat.tipo, color: 'text-gray-700', bgColor: 'bg-gray-100' };
            
            return (
              <div 
                key={stat.tipo} 
                className={`border rounded-lg p-3 space-y-2 transition-colors ${
                  onTipoClick && stat.pendentes > 0 
                    ? 'cursor-pointer hover:bg-muted/50 hover:border-primary/50' 
                    : ''
                }`}
                onClick={() => onTipoClick && stat.pendentes > 0 && onTipoClick(stat.tipo)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`${config.bgColor} ${config.color} border-0`}>
                      {config.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {stat.total} follow-ups
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {stat.taxaConversao >= 30 ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : stat.taxaConversao > 0 ? (
                      <TrendingDown className="w-4 h-4 text-amber-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${
                      stat.taxaConversao >= 30 ? 'text-green-600' : 
                      stat.taxaConversao > 0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {stat.taxaConversao}%
                    </span>
                  </div>
                </div>

                <Progress 
                  value={stat.taxaConversao} 
                  className="h-2"
                />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      {stat.concluidos} concluídos
                    </span>
                    <span className={`flex items-center gap-1 ${
                      onTipoClick && stat.pendentes > 0 ? 'text-primary font-medium' : ''
                    }`}>
                      <Clock className="w-3 h-3 text-amber-600" />
                      {stat.pendentes} pendentes
                      {onTipoClick && stat.pendentes > 0 && (
                        <ExternalLink className="w-3 h-3 ml-1" />
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-red-600" />
                      {stat.cancelados} cancelados
                    </span>
                  </div>
                  <span className="font-medium text-green-600">
                    {stat.conversoes} conversões
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
