import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ArrowLeft, 
  ShoppingCart, 
  AlertTriangle, 
  AlertCircle, 
  Skull, 
  Package, 
  Calendar,
  FileDown,
  Truck,
  Clock,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUnidade } from '@/contexts/UnidadeContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type PeriodoFiltro = 7 | 14 | 30;

type StatusEstoque = 'Normal' | 'Atenção' | 'Crítico' | 'Ruptura';

type Insumo = {
  id: string;
  codigo_insumo: string;
  nome_insumo: string;
  categoria: string;
  unidade_medida: string;
  quantidade_minima: number;
  lead_time_dias: number;
  estoque_seguranca_dias: number;
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
};

type ItemPrevisao = Insumo & {
  quantidade_atual: number;
  status_estoque: StatusEstoque;
  media_diaria: number;
  dias_restantes: number | null;
  ponto_pedido: number;
  data_ruptura: Date | null;
  data_limite_pedido: Date | null;
  dias_para_pedir: number | null;
  quantidade_sugerida: number;
  urgencia: 'imediata' | 'alta' | 'media' | 'baixa';
};

function calcularStatusPreditivo(
  quantidadeAtual: number,
  pontoPedido: number,
  dataLimitePedido: Date | null,
  dataRuptura: Date | null
): StatusEstoque {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (quantidadeAtual === 0) return 'Ruptura';
  if (dataRuptura && hoje > dataRuptura) return 'Ruptura';
  if (dataLimitePedido && hoje >= dataLimitePedido) return 'Crítico';
  if (quantidadeAtual <= pontoPedido) return 'Atenção';
  return 'Normal';
}

export default function RelatorioPrevisaoCompras() {
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();
  
  const [periodoFiltro, setPeriodoFiltro] = useState<PeriodoFiltro>(14);

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

  // Fetch movimentações últimos 30 dias
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes_estoque', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('unidade_id', unidadeAtual.id)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: !!unidadeAtual,
  });

  // Calcular itens que precisam ser pedidos
  const itensPrevisao: ItemPrevisao[] = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    return insumos.map(insumo => {
      const estoqueItem = estoque.find(e => e.insumo_id === insumo.id);
      const quantidade_atual = estoqueItem?.quantidade_atual || 0;
      
      // Médias de consumo
      const retiradas = movimentacoes.filter(m => m.insumo_id === insumo.id && m.tipo === 'retirada');
      const totalRetirado = retiradas.reduce((sum, m) => sum + m.quantidade, 0);
      const diasComOperacao = new Set(retiradas.map(m => m.created_at.split('T')[0])).size || 1;
      
      const media_diaria = totalRetirado / Math.max(diasComOperacao, 1);
      const dias_restantes = media_diaria > 0 ? Math.floor(quantidade_atual / media_diaria) : null;
      
      // Cálculos preditivos
      const leadTime = insumo.lead_time_dias || 3;
      const estoqueSeguranca = insumo.estoque_seguranca_dias || 2;
      const ponto_pedido = Math.ceil((leadTime + estoqueSeguranca) * media_diaria);
      
      const data_ruptura = dias_restantes !== null ? addDays(hoje, dias_restantes) : null;
      const data_limite_pedido = data_ruptura ? addDays(data_ruptura, -leadTime) : null;
      
      // Dias para pedir
      const dias_para_pedir = data_limite_pedido 
        ? differenceInDays(data_limite_pedido, hoje)
        : null;
      
      // Status
      const status_estoque = calcularStatusPreditivo(quantidade_atual, ponto_pedido, data_limite_pedido, data_ruptura);
      
      // Quantidade sugerida para pedir (repor para 30 dias de consumo)
      const consumo30dias = Math.ceil(media_diaria * 30);
      const quantidade_sugerida = Math.max(0, consumo30dias - quantidade_atual + ponto_pedido);
      
      // Urgência
      let urgencia: 'imediata' | 'alta' | 'media' | 'baixa' = 'baixa';
      if (status_estoque === 'Ruptura') urgencia = 'imediata';
      else if (status_estoque === 'Crítico') urgencia = 'imediata';
      else if (dias_para_pedir !== null && dias_para_pedir <= 3) urgencia = 'alta';
      else if (dias_para_pedir !== null && dias_para_pedir <= 7) urgencia = 'media';
      
      return {
        ...insumo,
        quantidade_atual,
        status_estoque,
        media_diaria: Math.round(media_diaria * 10) / 10,
        dias_restantes,
        ponto_pedido,
        data_ruptura,
        data_limite_pedido,
        dias_para_pedir,
        quantidade_sugerida,
        urgencia,
      };
    });
  }, [insumos, estoque, movimentacoes]);

  // Filtrar itens que precisam ser pedidos no período selecionado
  const itensFiltrados = useMemo(() => {
    return itensPrevisao
      .filter(item => {
        // Incluir se:
        // 1. Está em ruptura
        // 2. Está crítico
        // 3. Data limite de pedido está dentro do período
        if (item.status_estoque === 'Ruptura' || item.status_estoque === 'Crítico') return true;
        if (item.dias_para_pedir !== null && item.dias_para_pedir <= periodoFiltro) return true;
        return false;
      })
      .sort((a, b) => {
        // Ordenar por urgência
        const urgenciaPrioridade = { 'imediata': 0, 'alta': 1, 'media': 2, 'baixa': 3 };
        const urgenciaDiff = urgenciaPrioridade[a.urgencia] - urgenciaPrioridade[b.urgencia];
        if (urgenciaDiff !== 0) return urgenciaDiff;
        
        // Depois por dias para pedir
        const diasA = a.dias_para_pedir ?? 999;
        const diasB = b.dias_para_pedir ?? 999;
        return diasA - diasB;
      });
  }, [itensPrevisao, periodoFiltro]);

  // KPIs
  const kpis = useMemo(() => {
    const imediatos = itensFiltrados.filter(i => i.urgencia === 'imediata').length;
    const alta = itensFiltrados.filter(i => i.urgencia === 'alta').length;
    const media = itensFiltrados.filter(i => i.urgencia === 'media').length;
    const valorEstimado = itensFiltrados.reduce((sum, item) => sum + item.quantidade_sugerida, 0);
    
    return { imediatos, alta, media, total: itensFiltrados.length, valorEstimado };
  }, [itensFiltrados]);

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  const getUrgenciaBadge = (urgencia: string) => {
    switch (urgencia) {
      case 'imediata':
        return <Badge className="bg-black text-white gap-1"><Skull className="h-3 w-3" />Imediata</Badge>;
      case 'alta':
        return <Badge className="bg-destructive text-destructive-foreground gap-1"><AlertCircle className="h-3 w-3" />Alta</Badge>;
      case 'media':
        return <Badge className="bg-warning text-warning-foreground gap-1"><AlertTriangle className="h-3 w-3" />Média</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground gap-1"><Clock className="h-3 w-3" />Baixa</Badge>;
    }
  };

  const getStatusBadge = (status: StatusEstoque) => {
    switch (status) {
      case 'Ruptura':
        return <Badge className="bg-black text-white">Ruptura</Badge>;
      case 'Crítico':
        return <Badge className="bg-destructive text-destructive-foreground">Crítico</Badge>;
      case 'Atenção':
        return <Badge className="bg-warning text-warning-foreground">Atenção</Badge>;
      default:
        return <Badge className="bg-success text-success-foreground">Normal</Badge>;
    }
  };

  // Exportar PDF
  const exportarPDF = () => {
    const doc = new jsPDF();
    const dataAtual = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    
    // Título
    doc.setFontSize(18);
    doc.text('Relatório de Previsão de Compras', 14, 20);
    doc.setFontSize(10);
    doc.text(`${unidadeAtual?.nome || 'Unidade'} - Gerado em ${dataAtual}`, 14, 28);
    doc.text(`Período: Próximos ${periodoFiltro} dias`, 14, 34);
    
    // KPIs
    doc.setFontSize(12);
    doc.text('Resumo:', 14, 44);
    doc.setFontSize(10);
    doc.text(`• Total de itens para pedir: ${kpis.total}`, 20, 52);
    doc.text(`• Urgência imediata: ${kpis.imediatos}`, 20, 58);
    doc.text(`• Urgência alta: ${kpis.alta}`, 20, 64);
    doc.text(`• Urgência média: ${kpis.media}`, 20, 70);
    
    // Tabela
    const tableData = itensFiltrados.map(item => [
      item.nome_insumo,
      item.categoria,
      `${item.quantidade_atual} ${item.unidade_medida}`,
      item.ponto_pedido.toString(),
      item.dias_para_pedir !== null ? `${item.dias_para_pedir} dias` : '—',
      formatDate(item.data_limite_pedido),
      `${item.quantidade_sugerida} ${item.unidade_medida}`,
      item.urgencia.charAt(0).toUpperCase() + item.urgencia.slice(1),
    ]);
    
    autoTable(doc, {
      head: [['Insumo', 'Categoria', 'Estoque', 'Pto. Pedido', 'Dias p/ Pedir', 'Data Limite', 'Qtd. Sugerida', 'Urgência']],
      body: tableData,
      startY: 80,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data) => {
        // Colorir células de urgência
        if (data.column.index === 7 && data.section === 'body') {
          const urgencia = data.cell.raw as string;
          if (urgencia === 'Imediata') {
            data.cell.styles.fillColor = [0, 0, 0];
            data.cell.styles.textColor = [255, 255, 255];
          } else if (urgencia === 'Alta') {
            data.cell.styles.fillColor = [220, 38, 38];
            data.cell.styles.textColor = [255, 255, 255];
          } else if (urgencia === 'Média') {
            data.cell.styles.fillColor = [245, 158, 11];
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      },
    });
    
    doc.save(`previsao-compras-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF exportado com sucesso!' });
  };

  return (
    <Layout>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/estoque')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <ShoppingCart className="h-8 w-8 text-primary" />
                  Previsão de Compras
                </h1>
                <p className="text-muted-foreground">{unidadeAtual?.nome || 'Selecione uma unidade'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Filtro de período */}
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                {([7, 14, 30] as PeriodoFiltro[]).map(periodo => (
                  <Button
                    key={periodo}
                    variant={periodoFiltro === periodo ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPeriodoFiltro(periodo)}
                    className={periodoFiltro === periodo ? '' : 'hover:bg-background'}
                  >
                    {periodo} dias
                  </Button>
                ))}
              </div>
              <Button onClick={exportarPDF} variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total para Pedir</CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.total}</div>
                <p className="text-xs text-muted-foreground mt-1">itens nos próximos {periodoFiltro} dias</p>
              </CardContent>
            </Card>
            
            <Card className={`border-l-4 border-l-black bg-gradient-to-br from-gray-900/10 to-transparent ${kpis.imediatos > 0 ? 'ring-2 ring-black/30' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Urgência Imediata</CardTitle>
                <div className={`p-2 bg-black/10 rounded-lg ${kpis.imediatos > 0 ? 'animate-pulse' : ''}`}>
                  <Skull className="h-5 w-5 text-black" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.imediatos}</div>
                <p className="text-xs text-muted-foreground mt-1">pedir agora!</p>
              </CardContent>
            </Card>
            
            <Card className={`border-l-4 border-l-destructive bg-gradient-to-br from-destructive/5 to-transparent ${kpis.alta > 0 ? 'ring-2 ring-destructive/30' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Urgência Alta</CardTitle>
                <div className={`p-2 bg-destructive/10 rounded-lg ${kpis.alta > 0 ? 'animate-pulse' : ''}`}>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{kpis.alta}</div>
                <p className="text-xs text-muted-foreground mt-1">até 3 dias para pedir</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-warning bg-gradient-to-br from-warning/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Urgência Média</CardTitle>
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning">{kpis.media}</div>
                <p className="text-xs text-muted-foreground mt-1">até 7 dias para pedir</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Previsão */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  <span>Lista de Compras - Próximos {periodoFiltro} dias</span>
                </div>
                <Badge variant="outline" className="font-normal">
                  {itensFiltrados.length} item(s)
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="font-semibold">Insumo</TableHead>
                      <TableHead className="font-semibold text-center">Urgência</TableHead>
                      <TableHead className="font-semibold text-center">Status</TableHead>
                      <TableHead className="font-semibold text-center">Estoque Atual</TableHead>
                      <TableHead className="font-semibold text-center">Pto. Pedido</TableHead>
                      <TableHead className="font-semibold text-center">Consumo/Dia</TableHead>
                      <TableHead className="font-semibold text-center bg-primary/10 text-primary">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                            Dias p/ Pedir
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Dias restantes até a data limite para fazer o pedido</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="font-semibold text-center">Data Limite</TableHead>
                      <TableHead className="font-semibold text-center">Lead Time</TableHead>
                      <TableHead className="font-semibold text-center bg-success/10 text-success">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                            Qtd. Sugerida
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Quantidade sugerida para repor estoque para 30 dias</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensFiltrados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                          <Package className="h-12 w-12 mx-auto mb-3 text-success" />
                          <p className="text-lg font-medium text-success">Estoque sob controle!</p>
                          <p className="text-sm">Nenhum item precisa ser pedido nos próximos {periodoFiltro} dias.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      itensFiltrados.map(item => (
                        <TableRow 
                          key={item.id} 
                          className={`
                            transition-colors
                            ${item.urgencia === 'imediata' ? 'bg-black/5 hover:bg-black/10 border-l-4 border-l-black' : ''} 
                            ${item.urgencia === 'alta' ? 'bg-destructive/5 hover:bg-destructive/10 border-l-4 border-l-destructive' : ''} 
                            ${item.urgencia === 'media' ? 'bg-warning/5 hover:bg-warning/10 border-l-4 border-l-warning' : ''}
                            ${item.urgencia === 'baixa' ? 'hover:bg-muted/50' : ''}
                          `}
                        >
                          <TableCell>
                            <div>
                              <span className="font-semibold">{item.nome_insumo}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground font-mono">{item.codigo_insumo}</span>
                                <Badge variant="outline" className="font-normal text-xs h-5">
                                  {item.categoria}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{getUrgenciaBadge(item.urgencia)}</TableCell>
                          <TableCell className="text-center">{getStatusBadge(item.status_estoque)}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${
                              item.status_estoque === 'Ruptura' ? 'text-black' :
                              item.status_estoque === 'Crítico' ? 'text-destructive' : 
                              item.status_estoque === 'Atenção' ? 'text-warning' : ''
                            }`}>
                              {item.quantidade_atual}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unidade_medida}</span>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">{item.ponto_pedido}</TableCell>
                          <TableCell className="text-center text-sm">{item.media_diaria}</TableCell>
                          <TableCell className="text-center bg-primary/5">
                            {item.dias_para_pedir !== null ? (
                              <span className={`inline-flex items-center justify-center font-bold px-3 py-1.5 rounded-full text-sm ${
                                item.dias_para_pedir <= 0 ? 'bg-black/20 text-black' :
                                item.dias_para_pedir <= 3 ? 'bg-destructive/20 text-destructive' : 
                                item.dias_para_pedir <= 7 ? 'bg-warning/20 text-warning' : 
                                'bg-muted text-muted-foreground'
                              }`}>
                                {item.dias_para_pedir <= 0 ? 'Atrasado!' : `${item.dias_para_pedir} dias`}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-sm font-medium ${
                              item.urgencia === 'imediata' || item.urgencia === 'alta'
                                ? 'text-destructive font-bold' 
                                : 'text-muted-foreground'
                            }`}>
                              {formatDate(item.data_limite_pedido)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-normal">
                              {item.lead_time_dias}d
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center bg-success/5">
                            <span className="font-bold text-success">
                              {item.quantidade_sugerida}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unidade_medida}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Legenda */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-black" />
                  <span><strong>Imediata:</strong> Em ruptura ou crítico</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span><strong>Alta:</strong> Pedir em até 3 dias</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <span><strong>Média:</strong> Pedir em até 7 dias</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                  <span><strong>Baixa:</strong> Pedir dentro do período</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </Layout>
  );
}
