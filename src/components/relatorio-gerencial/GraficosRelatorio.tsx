import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RelatorioMes {
  mes_ano: string;
  ativos: number;
  vip: number;
  capacidade_zn: number;
  churn_percentual: number;
  tempo_medio_vida: number;
  cancelamentos: number;
  renovacoes: number;
}

interface GraficosRelatorioProps {
  dados: RelatorioMes[];
}

export function GraficosRelatorio({ dados }: GraficosRelatorioProps) {
  const chartData = dados.map(d => ({
    ...d,
    mes: format(parse(d.mes_ano, 'yyyy-MM', new Date()), 'MMM/yy', { locale: ptBR }),
    ocupacao: Number((((d.ativos + d.vip) / d.capacidade_zn) * 100).toFixed(1))
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ativos por mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ativos por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="ativos" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                  name="Ativos"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Churn por mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Churn (%) por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" unit="%" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value}%`, 'Churn']}
                />
                <Line 
                  type="monotone" 
                  dataKey="churn_percentual" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--destructive))' }}
                  name="Churn"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tempo médio de vida */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tempo Médio de Vida (meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value} meses`, 'Tempo Médio']}
                />
                <Line 
                  type="monotone" 
                  dataKey="tempo_medio_vida" 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(142, 76%, 36%)' }}
                  name="Tempo Médio"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cancelamentos e Renovações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cancelamentos vs Renovações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="cancelamentos" 
                  fill="hsl(var(--destructive))" 
                  name="Cancelamentos"
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="renovacoes" 
                  fill="hsl(142, 76%, 36%)" 
                  name="Renovações"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Ocupação por mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ocupação (%) por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" unit="%" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value}%`, 'Ocupação']}
                />
                <Line 
                  type="monotone" 
                  dataKey="ocupacao" 
                  stroke="hsl(221, 83%, 53%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(221, 83%, 53%)' }}
                  name="Ocupação"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
