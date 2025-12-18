import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, PieChart as PieIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Insumo = {
  id: string;
  codigo_insumo: string;
  nome_insumo: string;
  categoria: string;
};

type Movimentacao = {
  id: string;
  insumo_id: string;
  tipo: string;
  quantidade: number;
  setor: string | null;
  created_at: string;
};

interface RelatorioConsumoProps {
  insumos: Insumo[];
}

const CORES_CATEGORIAS: Record<string, string> = {
  'Copa e Recepção': 'hsl(var(--chart-1))',
  'Suplementos (uso interno)': 'hsl(var(--chart-2))',
  'Limpeza': 'hsl(var(--chart-3))',
  'Descartáveis': 'hsl(var(--chart-4))',
  'Higiene Pessoal': 'hsl(var(--chart-5))',
};

const CORES_ARRAY = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function RelatorioConsumo({ insumos }: RelatorioConsumoProps) {
  // Fetch movimentações dos últimos 6 meses
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['relatorio_consumo_6m'],
    queryFn: async () => {
      const seisAtras = startOfMonth(subMonths(new Date(), 5)).toISOString();
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('tipo', 'retirada')
        .gte('created_at', seisAtras)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Movimentacao[];
    },
  });

  // Dados para gráfico de tendência mensal por categoria
  const dadosTendenciaMensal = useMemo(() => {
    const meses: Record<string, Record<string, number>> = {};
    
    // Inicializar últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const mes = subMonths(new Date(), i);
      const chave = format(mes, 'yyyy-MM');
      meses[chave] = {
        'Copa e Recepção': 0,
        'Suplementos (uso interno)': 0,
        'Limpeza': 0,
        'Descartáveis': 0,
        'Higiene Pessoal': 0,
      };
    }

    // Somar consumo por mês e categoria
    movimentacoes.forEach(mov => {
      const mesChave = format(new Date(mov.created_at), 'yyyy-MM');
      const insumo = insumos.find(i => i.id === mov.insumo_id);
      if (insumo && meses[mesChave]) {
        meses[mesChave][insumo.categoria] = (meses[mesChave][insumo.categoria] || 0) + mov.quantidade;
      }
    });

    return Object.entries(meses).map(([mes, categorias]) => ({
      mes: format(new Date(mes + '-01'), 'MMM/yy', { locale: ptBR }),
      ...categorias,
    }));
  }, [movimentacoes, insumos]);

  // Dados para gráfico de pizza (consumo total por categoria)
  const dadosPizza = useMemo(() => {
    const totais: Record<string, number> = {};
    
    movimentacoes.forEach(mov => {
      const insumo = insumos.find(i => i.id === mov.insumo_id);
      if (insumo) {
        totais[insumo.categoria] = (totais[insumo.categoria] || 0) + mov.quantidade;
      }
    });

    return Object.entries(totais)
      .filter(([_, valor]) => valor > 0)
      .map(([categoria, valor]) => ({
        name: categoria,
        value: valor,
        fill: CORES_CATEGORIAS[categoria] || CORES_ARRAY[0],
      }));
  }, [movimentacoes, insumos]);

  // Dados para top 10 insumos mais consumidos
  const topInsumos = useMemo(() => {
    const totais: Record<string, number> = {};
    
    movimentacoes.forEach(mov => {
      totais[mov.insumo_id] = (totais[mov.insumo_id] || 0) + mov.quantidade;
    });

    return Object.entries(totais)
      .map(([insumoId, quantidade]) => {
        const insumo = insumos.find(i => i.id === insumoId);
        return {
          nome: insumo?.nome_insumo || 'Desconhecido',
          quantidade,
          categoria: insumo?.categoria || '',
        };
      })
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [movimentacoes, insumos]);

  // Consumo por setor
  const consumoPorSetor = useMemo(() => {
    const totais: Record<string, number> = {};
    
    movimentacoes.forEach(mov => {
      const setor = mov.setor || 'Não informado';
      totais[setor] = (totais[setor] || 0) + mov.quantidade;
    });

    return Object.entries(totais)
      .map(([setor, quantidade]) => ({ setor, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [movimentacoes]);

  const totalConsumo = movimentacoes.reduce((sum, m) => sum + m.quantidade, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6" />
        <h2 className="text-xl font-bold">Relatório de Consumo</h2>
        <span className="text-sm text-muted-foreground">(últimos 6 meses)</span>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Consumido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConsumo.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">unidades no período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Média Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalConsumo / 6).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">unidades/mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categorias Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dadosPizza.length}</div>
            <p className="text-xs text-muted-foreground">com consumo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movimentacoes.length}</div>
            <p className="text-xs text-muted-foreground">retiradas no período</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendência mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendência de Consumo por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosTendenciaMensal}>
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
                  <Line type="monotone" dataKey="Copa e Recepção" stroke={CORES_CATEGORIAS['Copa e Recepção']} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Suplementos (uso interno)" stroke={CORES_CATEGORIAS['Suplementos (uso interno)']} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Limpeza" stroke={CORES_CATEGORIAS['Limpeza']} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Descartáveis" stroke={CORES_CATEGORIAS['Descartáveis']} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Higiene Pessoal" stroke={CORES_CATEGORIAS['Higiene Pessoal']} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pizza por categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="h-4 w-4" />
              Distribuição por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dadosPizza.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosPizza}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {dadosPizza.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem dados de consumo no período
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top 10 insumos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Insumos Mais Consumidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {topInsumos.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topInsumos} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis type="category" dataKey="nome" width={120} className="text-xs" tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem dados de consumo no período
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Consumo por setor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumo por Setor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {consumoPorSetor.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={consumoPorSetor}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="setor" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="quantidade" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem dados de consumo no período
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
