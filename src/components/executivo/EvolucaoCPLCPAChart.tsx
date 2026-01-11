import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InvestimentoHistorico {
  id: string;
  data_inicio: string;
  data_fim: string;
  valor: number;
}

interface ChartDataPoint {
  mes: string;
  mesLabel: string;
  investimento: number;
  leads: number;
  matriculas: number;
  cpl: number | null;
  cpa: number | null;
}

export function EvolucaoCPLCPAChart() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      if (!unidadeAtual) return;
      
      setLoading(true);
      
      try {
        // Get last 6 months
        const meses: { inicio: string; fim: string; label: string; key: string }[] = [];
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          meses.push({
            inicio: format(startOfMonth(date), 'yyyy-MM-dd'),
            fim: format(endOfMonth(date), 'yyyy-MM-dd'),
            label: format(date, 'MMM/yy', { locale: ptBR }),
            key: format(date, 'yyyy-MM'),
          });
        }

        // Fetch all investments for the period
        const { data: investimentos } = await supabase
          .from('investimentos_marketing')
          .select('data_inicio, data_fim, valor')
          .eq('unidade_id', unidadeAtual.id)
          .gte('data_inicio', meses[0].inicio)
          .lte('data_fim', meses[meses.length - 1].fim);

        // Fetch leads for each month
        const { data: leads } = await supabase
          .from('leads')
          .select('created_at')
          .eq('unidade_id', unidadeAtual.id)
          .gte('created_at', meses[0].inicio)
          .lte('created_at', meses[meses.length - 1].fim + 'T23:59:59');

        // Fetch matriculas for each month
        const { data: interacoes } = await supabase
          .from('interacoes')
          .select('data_fechamento')
          .eq('unidade_id', unidadeAtual.id)
          .eq('fechou_matricula', true)
          .gte('data_fechamento', meses[0].inicio)
          .lte('data_fechamento', meses[meses.length - 1].fim);

        // Process data per month
        const dataPoints: ChartDataPoint[] = meses.map(mes => {
          // Find investment for this month
          const inv = investimentos?.find(i => 
            i.data_inicio === mes.inicio && i.data_fim === mes.fim
          );
          const investimento = inv ? Number(inv.valor) : 0;

          // Count leads for this month
          const leadsCount = leads?.filter(l => {
            const created = format(parseISO(l.created_at), 'yyyy-MM');
            return created === mes.key;
          }).length || 0;

          // Count matriculas for this month
          const matriculasCount = interacoes?.filter(i => {
            if (!i.data_fechamento) return false;
            const fechamento = format(parseISO(i.data_fechamento), 'yyyy-MM');
            return fechamento === mes.key;
          }).length || 0;

          // Calculate CPL and CPA
          const cpl = investimento > 0 && leadsCount > 0 
            ? investimento / leadsCount 
            : null;
          const cpa = investimento > 0 && matriculasCount > 0 
            ? investimento / matriculasCount 
            : null;

          return {
            mes: mes.key,
            mesLabel: mes.label.charAt(0).toUpperCase() + mes.label.slice(1),
            investimento,
            leads: leadsCount,
            matriculas: matriculasCount,
            cpl,
            cpa,
          };
        });

        setChartData(dataPoints);
      } catch (error) {
        console.error('Error fetching historical data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, [unidadeAtual]);

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint;
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold mb-2">{data.mesLabel}</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Investimento: {formatCurrency(data.investimento)}</p>
            <p>Leads: {data.leads}</p>
            <p>Matrículas: {data.matriculas}</p>
            <div className="border-t pt-1 mt-1">
              <p className="text-blue-600">CPL: {formatCurrency(data.cpl)}</p>
              <p className="text-emerald-600">CPA: {formatCurrency(data.cpa)}</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const hasData = useMemo(() => 
    chartData.some(d => d.cpl !== null || d.cpa !== null),
    [chartData]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-primary" />
          Evolução CPL e CPA (Últimos 6 meses)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Sem dados de investimento registrados</p>
            <p className="text-xs mt-1">Salve o investimento mensal para visualizar a evolução</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="mesLabel" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tickFormatter={(value) => `R$${value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}`}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="cpl" 
                name="CPL (Custo por Lead)"
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 6 }}
                connectNulls
              />
              <Line 
                type="monotone" 
                dataKey="cpa" 
                name="CPA (Custo por Aquisição)"
                stroke="hsl(142 76% 36%)" 
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(142 76% 36%)" }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}