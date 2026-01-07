import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  BarChart3, 
  AlertTriangle, 
  AlertCircle, 
  Skull, 
  Package, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  FileDown,
  RefreshCw,
  Target,
  Clock,
  Zap
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, startOfMonth, endOfMonth, subMonths, parseISO, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUnidade } from '@/contexts/UnidadeContext';
import { EstoqueNavigation } from '@/components/estoque/EstoqueNavigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type StatusEstoque = 'Normal' | 'Atenção' | 'Crítico' | 'Sem Estoque';
type ClasseABC = 'A' | 'B' | 'C';

type Insumo = {
  id: string;
  codigo_insumo: string;
  nome_insumo: string;
  categoria: string;
  unidade_medida: string;
  quantidade_minima: number;
  lead_time_dias: number;
  estoque_seguranca_dias: number;
  custo_unitario: number;
  fornecedor_padrao: string | null;
  ativo: boolean;
};

type EstoqueInterno = {
  id: string;
  insumo_id: string;
  quantidade_atual: number;
};

type Movimentacao = {
  id: string;
  insumo_id: string;
  tipo: string;
  quantidade: number;
  created_at: string;
  setor: string | null;
};

type ItemDashboard = Insumo & {
  quantidade_atual: number;
  status_estoque: StatusEstoque;
  media_diaria: number;
  dias_restantes: number | null;
  ponto_pedido: number;
  valor_estoque_atual: number;
  classe_abc: ClasseABC;
  giro_anual: number;
  total_consumido_30d: number;
  frequencia_retiradas: number;
};

type PeriodoFiltro = 7 | 14 | 30;

const COLORS_ABC = {
  A: 'hsl(var(--destructive))',
  B: 'hsl(var(--warning))',
  C: 'hsl(var(--muted))'
};

const COLORS_STATUS = {
  Normal: 'hsl(var(--success))',
  'Atenção': 'hsl(var(--warning))',
  Crítico: 'hsl(var(--destructive))',
  'Sem Estoque': 'hsl(0, 0%, 0%)'
};

function calcularStatusPreditivo(
  quantidadeAtual: number,
  pontoPedido: number,
  dataLimitePedido: Date | null,
  dataRuptura: Date | null
): StatusEstoque {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (quantidadeAtual === 0) return 'Sem Estoque';
  if (dataRuptura && hoje > dataRuptura) return 'Sem Estoque';
  if (dataLimitePedido && hoje >= dataLimitePedido) return 'Crítico';
  if (quantidadeAtual <= pontoPedido) return 'Atenção';
  return 'Normal';
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatNumber = (value: number) => {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
};

export default function DashboardExecutivoEstoque() {
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();
  const [periodoTendencia, setPeriodoTendencia] = useState<PeriodoFiltro>(30);
  const [activeTab, setActiveTab] = useState<'geral' | 'abc' | 'giro' | 'tendencia'>('geral');

  // Fetch insumos
  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .eq('ativo', true)
        .eq('unidade_id', unidadeAtual.id)
        .order('nome_insumo');
      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!unidadeAtual,
  });

  // Fetch estoque
  const { data: estoque = [] } = useQuery({
    queryKey: ['estoque_interno', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('estoque_interno')
        .select('*')
        .eq('unidade_id', unidadeAtual.id);
      if (error) throw error;
      return data as EstoqueInterno[];
    },
    enabled: !!unidadeAtual,
  });

  // Fetch movimentações últimos 60 dias (para comparativo)
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes_estoque_60d', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const sixtyDaysAgo = subDays(new Date(), 60).toISOString();
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('unidade_id', unidadeAtual.id)
        .gte('created_at', sixtyDaysAgo)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: !!unidadeAtual,
  });

  // Calcular itens com dados de dashboard
  const itensDashboard: ItemDashboard[] = useMemo(() => {
    const hoje = new Date();
    const trintaDiasAtras = subDays(hoje, 30);
    
    const itensCalculados = insumos.map(insumo => {
      const estoqueItem = estoque.find(e => e.insumo_id === insumo.id);
      const quantidade_atual = estoqueItem?.quantidade_atual || 0;
      
      // Filtrar movimentações dos últimos 30 dias para este item
      const retiradas30d = movimentacoes.filter(m => 
        m.insumo_id === insumo.id && 
        m.tipo === 'retirada' &&
        new Date(m.created_at) >= trintaDiasAtras
      );
      
      const total_consumido_30d = retiradas30d.reduce((sum, m) => sum + m.quantidade, 0);
      const frequencia_retiradas = retiradas30d.length;
      const diasComOperacao = new Set(retiradas30d.map(m => m.created_at.split('T')[0])).size || 1;
      
      // Cálculo da DURAÇÃO MÉDIA por unidade
      let duracao_media_por_unidade: number | null = null;
      
      if (retiradas30d.length >= 2 && total_consumido_30d > 0) {
        const retiradasOrdenadas = [...retiradas30d].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const primeiraRetirada = new Date(retiradasOrdenadas[0].created_at);
        const ultimaRetiradaData = new Date(retiradasOrdenadas[retiradasOrdenadas.length - 1].created_at);
        const periodoEmDias = Math.max(1, Math.ceil((ultimaRetiradaData.getTime() - primeiraRetirada.getTime()) / (1000 * 60 * 60 * 24)));
        duracao_media_por_unidade = Math.round((periodoEmDias / total_consumido_30d) * 10) / 10;
      }
      
      // Usar duração média se disponível
      let media_diaria: number;
      if (duracao_media_por_unidade && duracao_media_por_unidade > 0) {
        media_diaria = 1 / duracao_media_por_unidade;
      } else {
        media_diaria = total_consumido_30d / Math.max(diasComOperacao, 1);
      }
      
      const dias_restantes = quantidade_atual === 0 
        ? 0 
        : (media_diaria > 0 ? Math.floor(quantidade_atual / media_diaria) : null);
      
      // Cálculos preditivos
      const leadTime = insumo.lead_time_dias || 3;
      const estoqueSeguranca = insumo.estoque_seguranca_dias || 2;
      const ponto_pedido = Math.ceil((leadTime + estoqueSeguranca) * media_diaria);
      
      // Datas preditivas
      const data_ruptura = dias_restantes !== null ? addDays(hoje, dias_restantes) : null;
      const data_limite_pedido = data_ruptura ? addDays(data_ruptura, -leadTime) : null;
      
      const status_estoque = calcularStatusPreditivo(quantidade_atual, ponto_pedido, data_limite_pedido, data_ruptura);
      
      const custo = insumo.custo_unitario || 0;
      const valor_estoque_atual = quantidade_atual * custo;
      
      // Giro anual (projeção baseada nos 30 dias)
      const consumo_anual_projetado = total_consumido_30d * 12;
      const estoque_medio = quantidade_atual; // Simplificado
      const giro_anual = estoque_medio > 0 ? consumo_anual_projetado / estoque_medio : 0;
      
      return {
        ...insumo,
        quantidade_atual,
        status_estoque,
        media_diaria: Math.round(media_diaria * 10) / 10,
        dias_restantes,
        ponto_pedido,
        valor_estoque_atual,
        classe_abc: 'C' as ClasseABC, // Será calculado depois
        giro_anual: Math.round(giro_anual * 10) / 10,
        total_consumido_30d,
        frequencia_retiradas,
      };
    });
    
    // Calcular Curva ABC
    const valorTotal = itensCalculados.reduce((sum, i) => sum + i.valor_estoque_atual, 0);
    const itensOrdenados = [...itensCalculados].sort((a, b) => b.valor_estoque_atual - a.valor_estoque_atual);
    
    let acumulado = 0;
    itensOrdenados.forEach(item => {
      acumulado += item.valor_estoque_atual;
      const percentualAcumulado = valorTotal > 0 ? (acumulado / valorTotal) * 100 : 0;
      
      if (percentualAcumulado <= 80) {
        item.classe_abc = 'A';
      } else if (percentualAcumulado <= 95) {
        item.classe_abc = 'B';
      } else {
        item.classe_abc = 'C';
      }
    });
    
    return itensCalculados;
  }, [insumos, estoque, movimentacoes]);

  // KPIs Executivos
  const kpis = useMemo(() => {
    const valorTotalEstoque = itensDashboard.reduce((sum, i) => sum + i.valor_estoque_atual, 0);
    const itensRisco = itensDashboard.filter(i => i.status_estoque === 'Sem Estoque' || i.status_estoque === 'Crítico').length;
    
    // Acurácia: % de itens em nível adequado (Normal ou Atenção)
    const itensAdequados = itensDashboard.filter(i => i.status_estoque === 'Normal').length;
    const acuracia = itensDashboard.length > 0 ? (itensAdequados / itensDashboard.length) * 100 : 0;
    
    // Giro médio
    const itensComGiro = itensDashboard.filter(i => i.giro_anual > 0);
    const giroMedio = itensComGiro.length > 0 
      ? itensComGiro.reduce((sum, i) => sum + i.giro_anual, 0) / itensComGiro.length 
      : 0;
    
    // Cobertura média (dias de estoque)
    const itensComCobertura = itensDashboard.filter(i => i.dias_restantes !== null);
    const coberturaMédia = itensComCobertura.length > 0
      ? itensComCobertura.reduce((sum, i) => sum + (i.dias_restantes || 0), 0) / itensComCobertura.length
      : 0;
    
    return {
      valorTotalEstoque,
      giroMedio: Math.round(giroMedio * 10) / 10,
      acuracia: Math.round(acuracia),
      itensRisco,
      coberturaMédia: Math.round(coberturaMédia),
      totalItens: itensDashboard.length,
    };
  }, [itensDashboard]);

  // Dados da Curva ABC
  const curvaABC = useMemo(() => {
    const classeA = itensDashboard.filter(i => i.classe_abc === 'A');
    const classeB = itensDashboard.filter(i => i.classe_abc === 'B');
    const classeC = itensDashboard.filter(i => i.classe_abc === 'C');
    
    const valorA = classeA.reduce((sum, i) => sum + i.valor_estoque_atual, 0);
    const valorB = classeB.reduce((sum, i) => sum + i.valor_estoque_atual, 0);
    const valorC = classeC.reduce((sum, i) => sum + i.valor_estoque_atual, 0);
    const valorTotal = valorA + valorB + valorC;
    
    return {
      classes: [
        { name: 'Classe A', value: valorA, count: classeA.length, percentual: valorTotal > 0 ? (valorA / valorTotal) * 100 : 0 },
        { name: 'Classe B', value: valorB, count: classeB.length, percentual: valorTotal > 0 ? (valorB / valorTotal) * 100 : 0 },
        { name: 'Classe C', value: valorC, count: classeC.length, percentual: valorTotal > 0 ? (valorC / valorTotal) * 100 : 0 },
      ],
      top10: [...itensDashboard].sort((a, b) => b.valor_estoque_atual - a.valor_estoque_atual).slice(0, 10),
    };
  }, [itensDashboard]);

  // Dados de Giro de Estoque
  const dadosGiro = useMemo(() => {
    const itensComGiro = itensDashboard.filter(i => i.giro_anual > 0);
    
    // Classificação de giro
    const giroAlto = itensComGiro.filter(i => i.giro_anual >= 12);
    const giroMedio = itensComGiro.filter(i => i.giro_anual >= 6 && i.giro_anual < 12);
    const giroBaixo = itensComGiro.filter(i => i.giro_anual >= 2 && i.giro_anual < 6);
    const estoqueParado = itensComGiro.filter(i => i.giro_anual < 2);
    
    const valorParado = estoqueParado.reduce((sum, i) => sum + i.valor_estoque_atual, 0);
    
    return {
      top10MaiorGiro: [...itensComGiro].sort((a, b) => b.giro_anual - a.giro_anual).slice(0, 10),
      distribuicao: [
        { name: 'Alto (>12x)', count: giroAlto.length, color: 'hsl(var(--success))' },
        { name: 'Médio (6-12x)', count: giroMedio.length, color: 'hsl(var(--primary))' },
        { name: 'Baixo (2-6x)', count: giroBaixo.length, color: 'hsl(var(--warning))' },
        { name: 'Parado (<2x)', count: estoqueParado.length, color: 'hsl(var(--destructive))' },
      ],
      valorEstoqueParado: valorParado,
      itensParados: estoqueParado,
    };
  }, [itensDashboard]);

  // Dados de Tendência de Consumo
  const dadosTendencia = useMemo(() => {
    const hoje = new Date();
    const inicio = subDays(hoje, periodoTendencia);
    
    const movsFiltradas = movimentacoes.filter(m => 
      m.tipo === 'retirada' && 
      new Date(m.created_at) >= inicio
    );
    
    // Agrupar por dia
    const porDia: Record<string, number> = {};
    movsFiltradas.forEach(m => {
      const dia = format(new Date(m.created_at), 'dd/MM');
      porDia[dia] = (porDia[dia] || 0) + m.quantidade;
    });
    
    const dadosDiarios = Object.entries(porDia)
      .map(([dia, total]) => ({ dia, total }))
      .sort((a, b) => a.dia.localeCompare(b.dia));
    
    // Agrupar por categoria
    const porCategoria: Record<string, number> = {};
    movsFiltradas.forEach(m => {
      const insumo = insumos.find(i => i.id === m.insumo_id);
      const categoria = insumo?.categoria || 'Outros';
      porCategoria[categoria] = (porCategoria[categoria] || 0) + m.quantidade;
    });
    
    const dadosCategorias = Object.entries(porCategoria)
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);
    
    return { dadosDiarios, dadosCategorias };
  }, [movimentacoes, periodoTendencia, insumos]);

  // Comparativo Mensal
  const comparativoMensal = useMemo(() => {
    const hoje = new Date();
    const inicioMesAtual = startOfMonth(hoje);
    const fimMesAtual = endOfMonth(hoje);
    const inicioMesAnterior = startOfMonth(subMonths(hoje, 1));
    const fimMesAnterior = endOfMonth(subMonths(hoje, 1));
    
    const retiradasMesAtual = movimentacoes.filter(m => 
      m.tipo === 'retirada' &&
      new Date(m.created_at) >= inicioMesAtual &&
      new Date(m.created_at) <= fimMesAtual
    );
    
    const retiradasMesAnterior = movimentacoes.filter(m => 
      m.tipo === 'retirada' &&
      new Date(m.created_at) >= inicioMesAnterior &&
      new Date(m.created_at) <= fimMesAnterior
    );
    
    const totalAtual = retiradasMesAtual.reduce((sum, m) => sum + m.quantidade, 0);
    const totalAnterior = retiradasMesAnterior.reduce((sum, m) => sum + m.quantidade, 0);
    
    // Calcular valor consumido
    const valorAtual = retiradasMesAtual.reduce((sum, m) => {
      const insumo = insumos.find(i => i.id === m.insumo_id);
      return sum + (m.quantidade * (insumo?.custo_unitario || 0));
    }, 0);
    
    const valorAnterior = retiradasMesAnterior.reduce((sum, m) => {
      const insumo = insumos.find(i => i.id === m.insumo_id);
      return sum + (m.quantidade * (insumo?.custo_unitario || 0));
    }, 0);
    
    const diasDecorridosMes = differenceInDays(hoje, inicioMesAtual) + 1;
    const diasTotaisMes = differenceInDays(fimMesAtual, inicioMesAtual) + 1;
    const mediaAtual = totalAtual / diasDecorridosMes;
    const projecaoMes = mediaAtual * diasTotaisMes;
    
    const variacao = totalAnterior > 0 ? ((totalAtual - totalAnterior) / totalAnterior) * 100 : 0;
    
    return {
      mesAtual: {
        nome: format(hoje, 'MMMM', { locale: ptBR }),
        totalRetiradas: totalAtual,
        valorConsumido: valorAtual,
        mediaDiaria: Math.round(mediaAtual * 10) / 10,
      },
      mesAnterior: {
        nome: format(subMonths(hoje, 1), 'MMMM', { locale: ptBR }),
        totalRetiradas: totalAnterior,
        valorConsumido: valorAnterior,
      },
      variacao: Math.round(variacao),
      projecaoMes: Math.round(projecaoMes),
    };
  }, [movimentacoes, insumos]);

  // Ranking de Consumo
  const rankingConsumo = useMemo(() => {
    const top10Quantidade = [...itensDashboard]
      .filter(i => i.total_consumido_30d > 0)
      .sort((a, b) => b.total_consumido_30d - a.total_consumido_30d)
      .slice(0, 10);
    
    const top10Valor = [...itensDashboard]
      .filter(i => i.total_consumido_30d > 0)
      .sort((a, b) => (b.total_consumido_30d * b.custo_unitario) - (a.total_consumido_30d * a.custo_unitario))
      .slice(0, 10);
    
    const top10Frequencia = [...itensDashboard]
      .filter(i => i.frequencia_retiradas > 0)
      .sort((a, b) => b.frequencia_retiradas - a.frequencia_retiradas)
      .slice(0, 10);
    
    return { top10Quantidade, top10Valor, top10Frequencia };
  }, [itensDashboard]);

  // Saúde do Estoque
  const saudeEstoque = useMemo(() => {
    const normal = itensDashboard.filter(i => i.status_estoque === 'Normal').length;
    const atencao = itensDashboard.filter(i => i.status_estoque === 'Atenção').length;
    const critico = itensDashboard.filter(i => i.status_estoque === 'Crítico').length;
    const ruptura = itensDashboard.filter(i => i.status_estoque === 'Sem Estoque').length;
    
    return [
      { name: 'Normal', value: normal, color: COLORS_STATUS.Normal },
      { name: 'Atenção', value: atencao, color: COLORS_STATUS['Atenção'] },
      { name: 'Crítico', value: critico, color: COLORS_STATUS.Crítico },
      { name: 'Sem Estoque', value: ruptura, color: COLORS_STATUS['Sem Estoque'] },
    ];
  }, [itensDashboard]);

  const getStatusBadge = (status: StatusEstoque) => {
    switch (status) {
      case 'Sem Estoque':
        return <Badge className="bg-black text-white gap-1"><Skull className="h-3 w-3" />Sem Estoque</Badge>;
      case 'Crítico':
        return <Badge className="bg-destructive text-destructive-foreground gap-1"><AlertCircle className="h-3 w-3" />Crítico</Badge>;
      case 'Atenção':
        return <Badge className="bg-warning text-warning-foreground gap-1"><AlertTriangle className="h-3 w-3" />Atenção</Badge>;
      default:
        return <Badge className="bg-success text-success-foreground gap-1"><Package className="h-3 w-3" />Normal</Badge>;
    }
  };

  const getClasseBadge = (classe: ClasseABC) => {
    const colors = {
      A: 'bg-destructive text-destructive-foreground',
      B: 'bg-warning text-warning-foreground',
      C: 'bg-muted text-muted-foreground',
    };
    return <Badge className={colors[classe]}>Classe {classe}</Badge>;
  };

  // Exportar PDF
  const exportarPDF = () => {
    const doc = new jsPDF();
    const dataAtual = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    
    doc.setFontSize(18);
    doc.text('Dashboard Executivo de Estoque', 14, 20);
    doc.setFontSize(10);
    doc.text(`${unidadeAtual?.nome || 'Unidade'} - Gerado em ${dataAtual}`, 14, 28);
    
    // KPIs
    doc.setFontSize(12);
    doc.text('KPIs Executivos:', 14, 40);
    doc.setFontSize(10);
    doc.text(`• Valor total em estoque: ${formatCurrency(kpis.valorTotalEstoque)}`, 20, 48);
    doc.text(`• Giro médio anual: ${kpis.giroMedio}x`, 20, 54);
    doc.text(`• Acurácia de estoque: ${kpis.acuracia}%`, 20, 60);
    doc.text(`• Itens em risco: ${kpis.itensRisco}`, 20, 66);
    doc.text(`• Cobertura média: ${kpis.coberturaMédia} dias`, 20, 72);
    
    // Curva ABC
    doc.setFontSize(12);
    doc.text('Curva ABC:', 14, 84);
    doc.setFontSize(10);
    curvaABC.classes.forEach((classe, idx) => {
      doc.text(`• ${classe.name}: ${classe.count} itens (${classe.percentual.toFixed(1)}% do valor)`, 20, 92 + idx * 6);
    });
    
    // Comparativo Mensal
    doc.setFontSize(12);
    doc.text('Comparativo Mensal:', 14, 116);
    doc.setFontSize(10);
    doc.text(`• ${comparativoMensal.mesAtual.nome}: ${comparativoMensal.mesAtual.totalRetiradas} retiradas`, 20, 124);
    doc.text(`• ${comparativoMensal.mesAnterior.nome}: ${comparativoMensal.mesAnterior.totalRetiradas} retiradas`, 20, 130);
    doc.text(`• Variação: ${comparativoMensal.variacao > 0 ? '+' : ''}${comparativoMensal.variacao}%`, 20, 136);
    
    // Top 10 por valor
    const tableData = curvaABC.top10.map(item => [
      item.nome_insumo,
      item.classe_abc,
      formatCurrency(item.valor_estoque_atual),
      `${item.giro_anual}x`,
      item.status_estoque,
    ]);
    
    autoTable(doc, {
      head: [['Insumo', 'Classe', 'Valor Estoque', 'Giro Anual', 'Status']],
      body: tableData,
      startY: 146,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    doc.save(`dashboard-executivo-estoque-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF exportado com sucesso!' });
  };

  const chartConfig = {
    total: { label: 'Total', color: 'hsl(var(--primary))' },
  };

  return (
    <Layout>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  Dashboard Executivo
                </h1>
                <p className="text-sm text-muted-foreground">{unidadeAtual?.nome || 'Selecione uma unidade'}</p>
              </div>
              <Button onClick={exportarPDF} variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
            <EstoqueNavigation currentPage="dashboard" />
          </div>

          {/* KPIs Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="border-l-4 border-l-success bg-gradient-to-br from-success/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor em Estoque</CardTitle>
                <div className="p-2 bg-success/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(kpis.valorTotalEstoque)}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpis.totalItens} itens</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Giro Médio</CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <RefreshCw className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.giroMedio}x</div>
                <p className="text-xs text-muted-foreground mt-1">ao ano</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-500/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Acurácia</CardTitle>
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Target className="h-5 w-5 text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.acuracia}%</div>
                <p className="text-xs text-muted-foreground mt-1">itens em nível adequado</p>
              </CardContent>
            </Card>
            
            <Card className={`border-l-4 border-l-destructive bg-gradient-to-br from-destructive/5 to-transparent ${kpis.itensRisco > 0 ? 'ring-2 ring-destructive/30' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Itens em Risco</CardTitle>
                <div className={`p-2 bg-destructive/10 rounded-lg ${kpis.itensRisco > 0 ? 'animate-pulse' : ''}`}>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{kpis.itensRisco}</div>
                <p className="text-xs text-muted-foreground mt-1">crítico + ruptura</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-500/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cobertura Média</CardTitle>
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.coberturaMédia}</div>
                <p className="text-xs text-muted-foreground mt-1">dias de estoque</p>
              </CardContent>
            </Card>
          </div>

          {/* Saúde do Estoque + Comparativo Mensal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Saúde do Estoque */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Saúde do Estoque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="w-48 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={saudeEstoque}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {saudeEstoque.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-3">
                    {saudeEstoque.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <span className="font-semibold">{item.value} itens</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comparativo Mensal */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Comparativo Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground capitalize">{comparativoMensal.mesAtual.nome}</p>
                    <p className="text-2xl font-bold">{comparativoMensal.mesAtual.totalRetiradas}</p>
                    <p className="text-xs text-muted-foreground">retiradas</p>
                    <p className="text-sm font-medium mt-2">{formatCurrency(comparativoMensal.mesAtual.valorConsumido)}</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground capitalize">{comparativoMensal.mesAnterior.nome}</p>
                    <p className="text-2xl font-bold">{comparativoMensal.mesAnterior.totalRetiradas}</p>
                    <p className="text-xs text-muted-foreground">retiradas</p>
                    <p className="text-sm font-medium mt-2">{formatCurrency(comparativoMensal.mesAnterior.valorConsumido)}</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-muted/30 rounded-lg flex items-center justify-between">
                  <span className="text-sm">Variação</span>
                  <div className={`flex items-center gap-1 font-semibold ${comparativoMensal.variacao > 0 ? 'text-destructive' : comparativoMensal.variacao < 0 ? 'text-success' : ''}`}>
                    {comparativoMensal.variacao > 0 ? <TrendingUp className="h-4 w-4" /> : comparativoMensal.variacao < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                    {comparativoMensal.variacao > 0 ? '+' : ''}{comparativoMensal.variacao}%
                  </div>
                </div>
                <div className="mt-2 p-3 bg-primary/10 rounded-lg flex items-center justify-between">
                  <span className="text-sm">Projeção do mês</span>
                  <span className="font-semibold">{comparativoMensal.projecaoMes} retiradas</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs para análises detalhadas */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="geral">Ranking</TabsTrigger>
              <TabsTrigger value="abc">Curva ABC</TabsTrigger>
              <TabsTrigger value="giro">Giro de Estoque</TabsTrigger>
              <TabsTrigger value="tendencia">Tendência</TabsTrigger>
            </TabsList>

            {/* Tab Ranking */}
            <TabsContent value="geral" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* TOP 10 Quantidade */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      TOP 10 por Quantidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {rankingConsumo.top10Quantidade.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium py-2">
                              <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                              {item.nome_insumo}
                            </TableCell>
                            <TableCell className="text-right py-2 font-semibold">
                              {item.total_consumido_30d}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* TOP 10 Valor */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-success" />
                      TOP 10 por Valor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {rankingConsumo.top10Valor.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium py-2">
                              <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                              {item.nome_insumo}
                            </TableCell>
                            <TableCell className="text-right py-2 font-semibold">
                              {formatCurrency(item.total_consumido_30d * item.custo_unitario)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* TOP 10 Frequência */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-amber-500" />
                      TOP 10 por Frequência
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody>
                        {rankingConsumo.top10Frequencia.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium py-2">
                              <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                              {item.nome_insumo}
                            </TableCell>
                            <TableCell className="text-right py-2 font-semibold">
                              {item.frequencia_retiradas}x
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab Curva ABC */}
            <TabsContent value="abc" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {curvaABC.classes.map((classe, idx) => (
                  <Card key={idx} className={`border-l-4 ${idx === 0 ? 'border-l-destructive' : idx === 1 ? 'border-l-warning' : 'border-l-muted'}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold">{classe.name}</p>
                          <p className="text-muted-foreground">{classe.count} itens</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-semibold">{formatCurrency(classe.value)}</p>
                          <p className="text-sm text-muted-foreground">{classe.percentual.toFixed(1)}% do valor</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>TOP 10 Itens por Valor em Estoque</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Insumo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Classe</TableHead>
                        <TableHead className="text-right">Qtd. Atual</TableHead>
                        <TableHead className="text-right">Valor Estoque</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {curvaABC.top10.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.nome_insumo}</TableCell>
                          <TableCell>{item.categoria}</TableCell>
                          <TableCell>{getClasseBadge(item.classe_abc)}</TableCell>
                          <TableCell className="text-right">{item.quantidade_atual} {item.unidade_medida}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(item.valor_estoque_atual)}</TableCell>
                          <TableCell>{getStatusBadge(item.status_estoque)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Giro de Estoque */}
            <TabsContent value="giro" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dadosGiro.distribuicao.map((item, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                        <div>
                          <p className="text-sm text-muted-foreground">{item.name}</p>
                          <p className="text-2xl font-bold">{item.count}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {dadosGiro.valorEstoqueParado > 0 && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                        <div>
                          <p className="font-semibold">Capital Parado</p>
                          <p className="text-sm text-muted-foreground">{dadosGiro.itensParados.length} itens com giro &lt; 2x/ano</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-destructive">{formatCurrency(dadosGiro.valorEstoqueParado)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>TOP 10 Maior Giro</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Insumo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Giro Anual</TableHead>
                        <TableHead className="text-right">Consumo 30d</TableHead>
                        <TableHead className="text-right">Estoque Atual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dadosGiro.top10MaiorGiro.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.nome_insumo}</TableCell>
                          <TableCell>{item.categoria}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="font-semibold">
                              {item.giro_anual}x
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.total_consumido_30d} {item.unidade_medida}</TableCell>
                          <TableCell className="text-right">{item.quantidade_atual} {item.unidade_medida}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab Tendência */}
            <TabsContent value="tendencia" className="space-y-4">
              <div className="flex justify-end">
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                  {([7, 14, 30] as PeriodoFiltro[]).map(periodo => (
                    <Button
                      key={periodo}
                      variant={periodoTendencia === periodo ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setPeriodoTendencia(periodo)}
                    >
                      {periodo} dias
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Gráfico de Consumo Diário */}
                <Card>
                  <CardHeader>
                    <CardTitle>Consumo Diário</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dadosTendencia.dadosDiarios}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="dia" className="text-xs" />
                          <YAxis className="text-xs" />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line 
                            type="monotone" 
                            dataKey="total" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Consumo por Categoria */}
                <Card>
                  <CardHeader>
                    <CardTitle>Consumo por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dadosTendencia.dadosCategorias} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" className="text-xs" />
                          <YAxis dataKey="categoria" type="category" width={120} className="text-xs" />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </TooltipProvider>
    </Layout>
  );
}
