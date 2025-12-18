import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, PieChart as PieIcon, ArrowLeft, Package, Activity, Calendar, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useNavigate } from 'react-router-dom';

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

export default function RelatorioConsumo() {
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();

  // Fetch insumos
  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos_relatorio', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('insumos')
        .select('id, codigo_insumo, nome_insumo, categoria')
        .eq('ativo', true)
        .eq('unidade_id', unidadeAtual.id);
      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!unidadeAtual,
  });

  // Fetch movimentações dos últimos 6 meses
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['relatorio_consumo_6m', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const seisAtras = startOfMonth(subMonths(new Date(), 5)).toISOString();
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('tipo', 'retirada')
        .eq('unidade_id', unidadeAtual.id)
        .gte('created_at', seisAtras)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: !!unidadeAtual,
  });

  // Dados para gráfico de tendência mensal por categoria
  const dadosTendenciaMensal = useMemo(() => {
    const meses: Record<string, Record<string, number>> = {};
    
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
      total: Object.values(categorias).reduce((a, b) => a + b, 0),
    }));
  }, [movimentacoes, insumos]);

  // Dados para gráfico de pizza
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

  // Top 10 insumos mais consumidos
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

  // Consumo diário (últimos 30 dias)
  const consumoDiario = useMemo(() => {
    const dias: Record<string, number> = {};
    const hoje = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const dia = new Date(hoje);
      dia.setDate(dia.getDate() - i);
      const chave = format(dia, 'yyyy-MM-dd');
      dias[chave] = 0;
    }

    movimentacoes.forEach(mov => {
      const diaChave = format(new Date(mov.created_at), 'yyyy-MM-dd');
      if (dias[diaChave] !== undefined) {
        dias[diaChave] += mov.quantidade;
      }
    });

    return Object.entries(dias).map(([dia, quantidade]) => ({
      dia: format(new Date(dia), 'dd/MM', { locale: ptBR }),
      quantidade,
    }));
  }, [movimentacoes]);

  const totalConsumo = movimentacoes.reduce((sum, m) => sum + m.quantidade, 0);
  const mesAtual = dadosTendenciaMensal[dadosTendenciaMensal.length - 1]?.total || 0;
  const mesAnterior = dadosTendenciaMensal[dadosTendenciaMensal.length - 2]?.total || 0;
  const variacaoMensal = mesAnterior > 0 ? ((mesAtual - mesAnterior) / mesAnterior * 100).toFixed(1) : '0';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/estoque')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <TrendingUp className="h-8 w-8 text-primary" />
                Relatório de Consumo e Tendências
              </h1>
              <p className="text-muted-foreground">{unidadeAtual?.nome || 'Selecione uma unidade'} • Últimos 6 meses</p>
            </div>
          </div>
        </div>

        {/* KPIs principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Total Consumido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalConsumo.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">unidades no período</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border-chart-2/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Média Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{Math.round(totalConsumo / 6).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">unidades/mês</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-chart-3/10 to-chart-3/5 border-chart-3/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Variação Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${Number(variacaoMensal) >= 0 ? 'text-destructive' : 'text-green-600'}`}>
                {Number(variacaoMensal) >= 0 ? '+' : ''}{variacaoMensal}%
              </div>
              <p className="text-xs text-muted-foreground">vs. mês anterior</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-chart-4/10 to-chart-4/5 border-chart-4/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Movimentações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{movimentacoes.length}</div>
              <p className="text-xs text-muted-foreground">retiradas no período</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de tendência de consumo total */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Consumo Diário (últimos 30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={consumoDiario}>
                  <defs>
                    <linearGradient id="colorConsumo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dia" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="quantidade" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorConsumo)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráficos principais - 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tendência mensal por categoria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendência Mensal por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
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
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
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
              <div className="h-[350px]">
                {dadosPizza.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosPizza}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
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
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
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
        </div>

        {/* Gráficos secundários - 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 10 insumos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🏆 Top 10 Insumos Mais Consumidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {topInsumos.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topInsumos} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis type="category" dataKey="nome" width={150} className="text-xs" tick={{ fontSize: 11 }} />
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
              <CardTitle className="text-base">📍 Consumo por Setor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
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
    </Layout>
  );
}
