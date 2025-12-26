import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useUnidade } from '@/contexts/UnidadeContext';
import { EstoqueNavigation } from '@/components/estoque/EstoqueNavigation';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ArrowLeft, 
  Building2, 
  Receipt,
  Package,
  BarChart3,
  Calendar
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';

type Movimentacao = {
  id: string;
  insumo_id: string;
  tipo: string;
  quantidade: number;
  responsavel: string;
  created_at: string;
  valor_unitario: number | null;
  valor_total: number | null;
  fornecedor: string | null;
  nota_fiscal: string | null;
};

type Insumo = {
  id: string;
  nome_insumo: string;
  categoria: string;
  unidade_medida: string;
};

const PERIODOS = [
  { value: '3', label: 'Últimos 3 meses' },
  { value: '6', label: 'Últimos 6 meses' },
  { value: '12', label: 'Últimos 12 meses' },
];

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210, 70%, 50%)',
  'hsl(280, 70%, 50%)',
  'hsl(340, 70%, 50%)',
];

export default function RelatorioGastosEstoque() {
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();
  const [periodoMeses, setPeriodoMeses] = useState('6');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('all');
  const [fornecedorFiltro, setFornecedorFiltro] = useState<string>('all');

  const dataInicio = useMemo(() => {
    return startOfMonth(subMonths(new Date(), parseInt(periodoMeses)));
  }, [periodoMeses]);

  // Fetch movimentações de entrada com valor
  const { data: movimentacoes = [], isLoading: loadingMovimentacoes } = useQuery({
    queryKey: ['movimentacoes-gastos', unidadeAtual?.id, dataInicio],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('unidade_id', unidadeAtual.id)
        .eq('tipo', 'entrada')
        .not('valor_total', 'is', null)
        .gte('created_at', dataInicio.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: !!unidadeAtual?.id,
  });

  // Fetch insumos
  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-gastos', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      
      const { data, error } = await supabase
        .from('insumos')
        .select('id, nome_insumo, categoria, unidade_medida')
        .eq('unidade_id', unidadeAtual.id);

      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!unidadeAtual?.id,
  });

  // Mapear insumos por ID
  const insumosMap = useMemo(() => {
    return new Map(insumos.map(i => [i.id, i]));
  }, [insumos]);

  // Categorias disponíveis
  const categorias = useMemo(() => {
    const cats = new Set(insumos.map(i => i.categoria));
    return Array.from(cats).sort();
  }, [insumos]);

  // Fornecedores disponíveis
  const fornecedores = useMemo(() => {
    const forns = new Set(movimentacoes.filter(m => m.fornecedor).map(m => m.fornecedor!));
    return Array.from(forns).sort();
  }, [movimentacoes]);

  // Movimentações filtradas
  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter(m => {
      const insumo = insumosMap.get(m.insumo_id);
      if (!insumo) return false;
      
      if (categoriaFiltro !== 'all' && insumo.categoria !== categoriaFiltro) return false;
      if (fornecedorFiltro !== 'all' && m.fornecedor !== fornecedorFiltro) return false;
      
      return true;
    });
  }, [movimentacoes, insumosMap, categoriaFiltro, fornecedorFiltro]);

  // KPIs calculados
  const kpis = useMemo(() => {
    const totalGasto = movimentacoesFiltradas.reduce((acc, m) => acc + (m.valor_total || 0), 0);
    const mesesPeriodo = parseInt(periodoMeses);
    const mediaMensal = totalGasto / mesesPeriodo;

    // Calcular variação vs período anterior
    const metadeInicio = startOfMonth(subMonths(dataInicio, mesesPeriodo));
    const movPeriodoAnterior = movimentacoes.filter(m => {
      const data = parseISO(m.created_at);
      return data >= metadeInicio && data < dataInicio;
    });
    const totalAnterior = movPeriodoAnterior.reduce((acc, m) => acc + (m.valor_total || 0), 0);
    const variacao = totalAnterior > 0 ? ((totalGasto - totalAnterior) / totalAnterior) * 100 : 0;

    // Top fornecedor
    const gastosPorFornecedor = new Map<string, number>();
    movimentacoesFiltradas.forEach(m => {
      if (m.fornecedor) {
        gastosPorFornecedor.set(m.fornecedor, (gastosPorFornecedor.get(m.fornecedor) || 0) + (m.valor_total || 0));
      }
    });
    let topFornecedor = { nome: 'N/A', valor: 0 };
    gastosPorFornecedor.forEach((valor, nome) => {
      if (valor > topFornecedor.valor) {
        topFornecedor = { nome, valor };
      }
    });

    return { totalGasto, mediaMensal, variacao, topFornecedor };
  }, [movimentacoesFiltradas, periodoMeses, dataInicio, movimentacoes]);

  // Dados para gráfico de evolução mensal
  const evolucaoMensal = useMemo(() => {
    const gastosPorMes = new Map<string, number>();
    
    // Inicializar todos os meses do período
    for (let i = parseInt(periodoMeses) - 1; i >= 0; i--) {
      const mes = format(subMonths(new Date(), i), 'yyyy-MM');
      gastosPorMes.set(mes, 0);
    }
    
    movimentacoesFiltradas.forEach(m => {
      const mes = format(parseISO(m.created_at), 'yyyy-MM');
      if (gastosPorMes.has(mes)) {
        gastosPorMes.set(mes, (gastosPorMes.get(mes) || 0) + (m.valor_total || 0));
      }
    });

    return Array.from(gastosPorMes.entries()).map(([mes, valor]) => ({
      mes: format(parseISO(mes + '-01'), 'MMM/yy', { locale: ptBR }),
      valor,
    }));
  }, [movimentacoesFiltradas, periodoMeses]);

  // Dados para gráfico de gastos por categoria
  const gastosPorCategoria = useMemo(() => {
    const gastos = new Map<string, number>();
    
    movimentacoesFiltradas.forEach(m => {
      const insumo = insumosMap.get(m.insumo_id);
      if (insumo) {
        gastos.set(insumo.categoria, (gastos.get(insumo.categoria) || 0) + (m.valor_total || 0));
      }
    });

    return Array.from(gastos.entries())
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [movimentacoesFiltradas, insumosMap]);

  // Dados para gráfico de gastos por fornecedor
  const gastosPorFornecedor = useMemo(() => {
    const gastos = new Map<string, { valor: number; compras: number }>();
    
    movimentacoesFiltradas.forEach(m => {
      const fornecedor = m.fornecedor || 'Não informado';
      const atual = gastos.get(fornecedor) || { valor: 0, compras: 0 };
      gastos.set(fornecedor, {
        valor: atual.valor + (m.valor_total || 0),
        compras: atual.compras + 1,
      });
    });

    return Array.from(gastos.entries())
      .map(([fornecedor, data]) => ({ 
        fornecedor, 
        valor: data.valor, 
        compras: data.compras,
        ticketMedio: data.compras > 0 ? data.valor / data.compras : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [movimentacoesFiltradas]);

  // Variação de preços por insumo
  const variacaoPrecos = useMemo(() => {
    const precosPorInsumo = new Map<string, { valores: number[]; nome: string }>();
    
    movimentacoesFiltradas.forEach(m => {
      if (m.valor_unitario) {
        const insumo = insumosMap.get(m.insumo_id);
        if (insumo) {
          const atual = precosPorInsumo.get(m.insumo_id) || { valores: [], nome: insumo.nome_insumo };
          atual.valores.push(m.valor_unitario);
          precosPorInsumo.set(m.insumo_id, atual);
        }
      }
    });

    const variacoes: { nome: string; variacao: number; precoAtual: number; precoMedio: number }[] = [];
    
    precosPorInsumo.forEach((data, id) => {
      if (data.valores.length >= 2) {
        const precoAtual = data.valores[0]; // Mais recente
        const precoMedio = data.valores.reduce((a, b) => a + b, 0) / data.valores.length;
        const variacao = ((precoAtual - precoMedio) / precoMedio) * 100;
        
        variacoes.push({
          nome: data.nome,
          variacao,
          precoAtual,
          precoMedio,
        });
      }
    });

    return {
      maioresAltas: variacoes.filter(v => v.variacao > 0).sort((a, b) => b.variacao - a.variacao).slice(0, 5),
      maioresBaixas: variacoes.filter(v => v.variacao < 0).sort((a, b) => a.variacao - b.variacao).slice(0, 5),
    };
  }, [movimentacoesFiltradas, insumosMap]);

  // Histórico de compras para tabela
  const historicoCompras = useMemo(() => {
    return movimentacoesFiltradas.slice(0, 50).map(m => {
      const insumo = insumosMap.get(m.insumo_id);
      return {
        ...m,
        nomeInsumo: insumo?.nome_insumo || 'Desconhecido',
        categoria: insumo?.categoria || 'N/A',
        unidade: insumo?.unidade_medida || 'un',
      };
    });
  }, [movimentacoesFiltradas, insumosMap]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const chartConfig = {
    valor: {
      label: 'Valor',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Relatório de Gastos</h1>
              <p className="text-sm text-muted-foreground">Análise de custos com estoque</p>
            </div>

            <div className="flex flex-wrap gap-3">
            <Select value={periodoMeses} onValueChange={setPeriodoMeses}>
              <SelectTrigger className="w-44">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="w-48">
                <Package className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categorias.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={fornecedorFiltro} onValueChange={setFornecedorFiltro}>
              <SelectTrigger className="w-48">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Fornecedores</SelectItem>
                {fornecedores.map(forn => (
                  <SelectItem key={forn} value={forn}>{forn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          </div>
          <EstoqueNavigation currentPage="gastos" />
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Gasto</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.totalGasto)}</p>
                  <p className="text-xs text-muted-foreground">últimos {periodoMeses} meses</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-chart-2/10 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-chart-2" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Média Mensal</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.mediaMensal)}</p>
                  <p className="text-xs text-muted-foreground">por mês</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${kpis.variacao > 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
                  {kpis.variacao > 0 ? (
                    <TrendingUp className="h-6 w-6 text-destructive" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-success" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Variação</p>
                  <p className={`text-2xl font-bold ${kpis.variacao > 0 ? 'text-destructive' : 'text-success'}`}>
                    {kpis.variacao > 0 ? '+' : ''}{kpis.variacao.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">vs período anterior</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-chart-4/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-chart-4" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Top Fornecedor</p>
                  <p className="text-lg font-bold text-foreground truncate max-w-[150px]">{kpis.topFornecedor.nome}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(kpis.topFornecedor.valor)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evolução Mensal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolução de Gastos Mensais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-72">
                <BarChart data={evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis 
                    tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} 
                    className="text-xs"
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent 
                      formatter={(value) => formatCurrency(Number(value))}
                    />} 
                  />
                  <Bar 
                    dataKey="valor" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Gastos por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-chart-2" />
                Gastos por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <ChartContainer config={chartConfig} className="h-72 flex-1">
                  <PieChart>
                    <Pie
                      data={gastosPorCategoria}
                      dataKey="valor"
                      nameKey="categoria"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                    >
                      {gastosPorCategoria.map((entry, index) => (
                        <Cell key={entry.categoria} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      content={<ChartTooltipContent 
                        formatter={(value) => formatCurrency(Number(value))}
                      />} 
                    />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                  {gastosPorCategoria.slice(0, 5).map((cat, index) => (
                    <div key={cat.categoria} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                      />
                      <span className="truncate max-w-[100px] text-muted-foreground">{cat.categoria}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gastos por Fornecedor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-chart-4" />
              Gastos por Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-80">
              <BarChart data={gastosPorFornecedor} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  type="number" 
                  tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}
                  className="text-xs"
                />
                <YAxis 
                  type="category" 
                  dataKey="fornecedor" 
                  width={120}
                  className="text-xs"
                />
                <ChartTooltip 
                  content={<ChartTooltipContent 
                    formatter={(value) => formatCurrency(Number(value))}
                  />} 
                />
                <Bar 
                  dataKey="valor" 
                  fill="hsl(var(--chart-4))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Variação de Preços */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <TrendingUp className="h-5 w-5" />
                Maiores Altas de Preço
              </CardTitle>
            </CardHeader>
            <CardContent>
              {variacaoPrecos.maioresAltas.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Sem dados suficientes</p>
              ) : (
                <div className="space-y-3">
                  {variacaoPrecos.maioresAltas.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Média: {formatCurrency(item.precoMedio)} → Atual: {formatCurrency(item.precoAtual)}
                        </p>
                      </div>
                      <Badge variant="destructive">+{item.variacao.toFixed(1)}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-success">
                <TrendingDown className="h-5 w-5" />
                Maiores Quedas de Preço
              </CardTitle>
            </CardHeader>
            <CardContent>
              {variacaoPrecos.maioresBaixas.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Sem dados suficientes</p>
              ) : (
                <div className="space-y-3">
                  {variacaoPrecos.maioresBaixas.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-success/5 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Média: {formatCurrency(item.precoMedio)} → Atual: {formatCurrency(item.precoAtual)}
                        </p>
                      </div>
                      <Badge className="bg-success text-success-foreground">{item.variacao.toFixed(1)}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Histórico de Compras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>NF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoCompras.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhuma compra registrada no período
                      </TableCell>
                    </TableRow>
                  ) : (
                    historicoCompras.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(mov.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">{mov.nomeInsumo}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{mov.categoria}</Badge>
                        </TableCell>
                        <TableCell>{mov.fornecedor || '-'}</TableCell>
                        <TableCell className="text-right">
                          {mov.quantidade} {mov.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {mov.valor_unitario ? formatCurrency(mov.valor_unitario) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {mov.valor_total ? formatCurrency(mov.valor_total) : '-'}
                        </TableCell>
                        <TableCell>{mov.nota_fiscal || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
