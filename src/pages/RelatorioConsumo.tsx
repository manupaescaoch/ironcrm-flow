import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, PieChart as PieIcon, ArrowLeft, Package, Activity, Calendar as CalendarIcon, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth, differenceInMonths, eachMonthOfInterval, subDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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

type PeriodoOption = '3m' | '6m' | '12m' | 'custom';

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
  
  // Período states
  const [periodo, setPeriodo] = useState<PeriodoOption>('6m');
  const [dataInicio, setDataInicio] = useState<Date | undefined>(startOfMonth(subMonths(new Date(), 5)));
  const [dataFim, setDataFim] = useState<Date | undefined>(endOfMonth(new Date()));

  // Calcular datas baseado no período selecionado
  const { dataInicioCalc, dataFimCalc, numMeses } = useMemo(() => {
    const hoje = new Date();
    let inicio: Date;
    let fim = endOfMonth(hoje);
    
    if (periodo === 'custom' && dataInicio && dataFim) {
      inicio = startOfMonth(dataInicio);
      fim = endOfMonth(dataFim);
    } else {
      const meses = periodo === '3m' ? 3 : periodo === '12m' ? 12 : 6;
      inicio = startOfMonth(subMonths(hoje, meses - 1));
    }
    
    const numMeses = Math.max(1, differenceInMonths(fim, inicio) + 1);
    
    return { dataInicioCalc: inicio, dataFimCalc: fim, numMeses };
  }, [periodo, dataInicio, dataFim]);

  const periodoLabel = useMemo(() => {
    if (periodo === 'custom' && dataInicio && dataFim) {
      return `${format(dataInicio, 'MMM/yy', { locale: ptBR })} - ${format(dataFim, 'MMM/yy', { locale: ptBR })}`;
    }
    return periodo === '3m' ? 'Últimos 3 meses' : periodo === '12m' ? 'Últimos 12 meses' : 'Últimos 6 meses';
  }, [periodo, dataInicio, dataFim]);

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

  // Fetch movimentações baseado no período
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['relatorio_consumo', unidadeAtual?.id, dataInicioCalc.toISOString(), dataFimCalc.toISOString()],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('tipo', 'retirada')
        .eq('unidade_id', unidadeAtual.id)
        .gte('created_at', dataInicioCalc.toISOString())
        .lte('created_at', dataFimCalc.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: !!unidadeAtual,
  });

  // Dados para gráfico de tendência mensal por categoria
  const dadosTendenciaMensal = useMemo(() => {
    const meses: Record<string, Record<string, number>> = {};
    
    // Gerar todos os meses do período
    const mesesIntervalo = eachMonthOfInterval({ start: dataInicioCalc, end: dataFimCalc });
    mesesIntervalo.forEach(mes => {
      const chave = format(mes, 'yyyy-MM');
      meses[chave] = {
        'Copa e Recepção': 0,
        'Suplementos (uso interno)': 0,
        'Limpeza': 0,
        'Descartáveis': 0,
        'Higiene Pessoal': 0,
      };
    });

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
  }, [movimentacoes, insumos, dataInicioCalc, dataFimCalc]);

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

  // Consumo diário (últimos 30 dias do período)
  const consumoDiario = useMemo(() => {
    const dias: Record<string, number> = {};
    const fimPeriodo = dataFimCalc;
    const inicioDiario = subDays(fimPeriodo, 29);
    
    const diasIntervalo = eachDayOfInterval({ start: inicioDiario, end: fimPeriodo });
    diasIntervalo.forEach(dia => {
      const chave = format(dia, 'yyyy-MM-dd');
      dias[chave] = 0;
    });

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
  }, [movimentacoes, dataFimCalc]);

  const totalConsumo = movimentacoes.reduce((sum, m) => sum + m.quantidade, 0);
  const mesAtual = dadosTendenciaMensal[dadosTendenciaMensal.length - 1]?.total || 0;
  const mesAnterior = dadosTendenciaMensal[dadosTendenciaMensal.length - 2]?.total || 0;
  const variacaoMensal = mesAnterior > 0 ? ((mesAtual - mesAnterior) / mesAnterior * 100).toFixed(1) : '0';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/estoque')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <TrendingUp className="h-8 w-8 text-primary" />
                Relatório de Consumo e Tendências
              </h1>
              <p className="text-muted-foreground">{unidadeAtual?.nome || 'Selecione uma unidade'} • {periodoLabel}</p>
            </div>
          </div>
          
          {/* Filtro de Período */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Período:</span>
              <div className="flex gap-2">
                <Button 
                  variant={periodo === '3m' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setPeriodo('3m')}
                >
                  3 meses
                </Button>
                <Button 
                  variant={periodo === '6m' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setPeriodo('6m')}
                >
                  6 meses
                </Button>
                <Button 
                  variant={periodo === '12m' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setPeriodo('12m')}
                >
                  12 meses
                </Button>
                <Button 
                  variant={periodo === 'custom' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setPeriodo('custom')}
                >
                  Personalizado
                </Button>
              </div>
              
              {periodo === 'custom' && (
                <div className="flex gap-2 items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataInicio ? format(dataInicio, "MMM/yyyy", { locale: ptBR }) : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={setDataInicio}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">até</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataFim ? format(dataFim, "MMM/yyyy", { locale: ptBR }) : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataFim}
                        onSelect={setDataFim}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </Card>
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
                <CalendarIcon className="h-4 w-4" />
                Média Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{Math.round(totalConsumo / numMeses).toLocaleString()}</div>
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
              Consumo Diário (últimos 30 dias do período)
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
