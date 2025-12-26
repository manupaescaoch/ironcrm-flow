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
  DollarSign, 
  AlertTriangle, 
  AlertCircle, 
  Skull, 
  Package, 
  TrendingUp,
  Building2,
  Tags,
  Calendar,
  FileDown,
  Info
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUnidade } from '@/contexts/UnidadeContext';
import { EstoqueNavigation } from '@/components/estoque/EstoqueNavigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type StatusEstoque = 'Normal' | 'Atenção' | 'Crítico' | 'Sem Estoque';

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
  quantidade_minima_compra: number;
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

type ItemFinanceiro = Insumo & {
  quantidade_atual: number;
  status_estoque: StatusEstoque;
  media_diaria: number;
  dias_restantes: number | null;
  ponto_pedido: number;
  data_limite_pedido: Date | null;
  dias_para_pedir: number | null;
  valor_estoque_atual: number;
  valor_ponto_pedido: number;
  valor_reposicao: number;
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

export default function VisaoFinanceiraEstoque() {
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'resumo' | 'fornecedor' | 'categoria'>('resumo');

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

  // Fetch movimentações
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

  // Calcular itens com dados financeiros
  const itensFinanceiros: ItemFinanceiro[] = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    return insumos.map(insumo => {
      const estoqueItem = estoque.find(e => e.insumo_id === insumo.id);
      const quantidade_atual = estoqueItem?.quantidade_atual || 0;
      
      const retiradas = movimentacoes.filter(m => m.insumo_id === insumo.id && m.tipo === 'retirada');
      const totalRetirado = retiradas.reduce((sum, m) => sum + m.quantidade, 0);
      const diasComOperacao = new Set(retiradas.map(m => m.created_at.split('T')[0])).size || 1;
      
      const media_diaria = totalRetirado / Math.max(diasComOperacao, 1);
      const dias_restantes = media_diaria > 0 ? Math.floor(quantidade_atual / media_diaria) : null;
      
      const leadTime = insumo.lead_time_dias || 3;
      const estoqueSeguranca = insumo.estoque_seguranca_dias || 2;
      const ponto_pedido = Math.ceil((leadTime + estoqueSeguranca) * media_diaria);
      
      const data_ruptura = dias_restantes !== null ? addDays(hoje, dias_restantes) : null;
      const data_limite_pedido = data_ruptura ? addDays(data_ruptura, -leadTime) : null;
      const dias_para_pedir = data_limite_pedido ? differenceInDays(data_limite_pedido, hoje) : null;
      
      const status_estoque = calcularStatusPreditivo(quantidade_atual, ponto_pedido, data_limite_pedido, data_ruptura);
      
      const custo = insumo.custo_unitario || 0;
      const qtdMinimaCompra = insumo.quantidade_minima_compra || 1;
      
      return {
        ...insumo,
        quantidade_atual,
        status_estoque,
        media_diaria: Math.round(media_diaria * 10) / 10,
        dias_restantes,
        ponto_pedido,
        data_limite_pedido,
        dias_para_pedir,
        valor_estoque_atual: quantidade_atual * custo,
        valor_ponto_pedido: ponto_pedido * custo,
        valor_reposicao: qtdMinimaCompra * custo,
      };
    });
  }, [insumos, estoque, movimentacoes]);

  // Filtrar itens que precisam de atenção (não Normal)
  const itensAtencao = useMemo(() => {
    return itensFinanceiros.filter(i => i.status_estoque !== 'Normal');
  }, [itensFinanceiros]);

  // Projeções financeiras por período
  const projecoes = useMemo(() => {
    const calcularProjecao = (dias: number) => {
      return itensFinanceiros
        .filter(item => item.dias_para_pedir !== null && item.dias_para_pedir <= dias)
        .reduce((sum, item) => sum + item.valor_reposicao, 0);
    };

    return {
      dias7: calcularProjecao(7),
      dias15: calcularProjecao(15),
      dias30: calcularProjecao(30),
    };
  }, [itensFinanceiros]);

  // Agrupar por fornecedor
  const porFornecedor = useMemo(() => {
    const grupos: Record<string, { itens: ItemFinanceiro[]; total: number }> = {};
    
    itensAtencao.forEach(item => {
      const fornecedor = item.fornecedor_padrao || 'Não definido';
      if (!grupos[fornecedor]) {
        grupos[fornecedor] = { itens: [], total: 0 };
      }
      grupos[fornecedor].itens.push(item);
      grupos[fornecedor].total += item.valor_reposicao;
    });
    
    return Object.entries(grupos)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([nome, dados]) => ({ nome, ...dados }));
  }, [itensAtencao]);

  // Agrupar por categoria
  const porCategoria = useMemo(() => {
    const grupos: Record<string, { itens: ItemFinanceiro[]; total: number }> = {};
    
    itensAtencao.forEach(item => {
      if (!grupos[item.categoria]) {
        grupos[item.categoria] = { itens: [], total: 0 };
      }
      grupos[item.categoria].itens.push(item);
      grupos[item.categoria].total += item.valor_reposicao;
    });
    
    return Object.entries(grupos)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([nome, dados]) => ({ nome, ...dados }));
  }, [itensAtencao]);

  // KPIs
  const kpis = useMemo(() => {
    const valorTotalEstoque = itensFinanceiros.reduce((sum, i) => sum + i.valor_estoque_atual, 0);
    const valorReposicaoNecessaria = itensAtencao.reduce((sum, i) => sum + i.valor_reposicao, 0);
    const itensRupturaCritico = itensAtencao.filter(i => i.status_estoque === 'Sem Estoque' || i.status_estoque === 'Crítico').length;
    
    return {
      valorTotalEstoque,
      valorReposicaoNecessaria,
      totalItensAtencao: itensAtencao.length,
      itensRupturaCritico,
    };
  }, [itensFinanceiros, itensAtencao]);

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

  // Exportar PDF
  const exportarPDF = () => {
    const doc = new jsPDF();
    const dataAtual = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    
    doc.setFontSize(18);
    doc.text('Visão Financeira de Estoque', 14, 20);
    doc.setFontSize(10);
    doc.text(`${unidadeAtual?.nome || 'Unidade'} - Gerado em ${dataAtual}`, 14, 28);
    
    // KPIs
    doc.setFontSize(12);
    doc.text('Resumo Financeiro:', 14, 40);
    doc.setFontSize(10);
    doc.text(`• Valor total em estoque: ${formatCurrency(kpis.valorTotalEstoque)}`, 20, 48);
    doc.text(`• Valor necessário para reposição: ${formatCurrency(kpis.valorReposicaoNecessaria)}`, 20, 54);
    doc.text(`• Itens que precisam de atenção: ${kpis.totalItensAtencao}`, 20, 60);
    
    // Projeções
    doc.setFontSize(12);
    doc.text('Projeção de Caixa:', 14, 72);
    doc.setFontSize(10);
    doc.text(`• Próximos 7 dias: ${formatCurrency(projecoes.dias7)}`, 20, 80);
    doc.text(`• Próximos 15 dias: ${formatCurrency(projecoes.dias15)}`, 20, 86);
    doc.text(`• Próximos 30 dias: ${formatCurrency(projecoes.dias30)}`, 20, 92);
    
    // Tabela
    const tableData = itensAtencao.map(item => [
      item.nome_insumo,
      item.fornecedor_padrao || 'N/D',
      item.status_estoque,
      formatCurrency(item.valor_estoque_atual),
      formatCurrency(item.valor_reposicao),
    ]);
    
    autoTable(doc, {
      head: [['Insumo', 'Fornecedor', 'Status', 'Valor Estoque', 'Valor Reposição']],
      body: tableData,
      startY: 102,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    doc.save(`visao-financeira-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF exportado com sucesso!' });
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
                  <DollarSign className="h-6 w-6 text-success" />
                  Visão Financeira
                </h1>
                <p className="text-sm text-muted-foreground">{unidadeAtual?.nome || 'Selecione uma unidade'}</p>
              </div>
              <Button onClick={exportarPDF} variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
            <EstoqueNavigation currentPage="financeiro" />
          </div>

          {/* KPIs Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-success bg-gradient-to-br from-success/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total em Estoque</CardTitle>
                <div className="p-2 bg-success/10 rounded-lg">
                  <Package className="h-5 w-5 text-success" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(kpis.valorTotalEstoque)}</div>
                <p className="text-xs text-muted-foreground mt-1">{itensFinanceiros.length} itens</p>
              </CardContent>
            </Card>
            
            <Card className={`border-l-4 border-l-destructive bg-gradient-to-br from-destructive/5 to-transparent ${kpis.itensRupturaCritico > 0 ? 'ring-2 ring-destructive/30' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Reposição Necessária</CardTitle>
                <div className={`p-2 bg-destructive/10 rounded-lg ${kpis.itensRupturaCritico > 0 ? 'animate-pulse' : ''}`}>
                  <TrendingUp className="h-5 w-5 text-destructive" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(kpis.valorReposicaoNecessaria)}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpis.totalItensAtencao} itens para repor</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-warning bg-gradient-to-br from-warning/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Próximos 7 Dias</CardTitle>
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-warning" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{formatCurrency(projecoes.dias7)}</div>
                <p className="text-xs text-muted-foreground mt-1">necessidade de caixa</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Próximos 30 Dias</CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(projecoes.dias30)}</div>
                <p className="text-xs text-muted-foreground mt-1">projeção total</p>
              </CardContent>
            </Card>
          </div>

          {/* Projeção de Caixa Detalhada */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-success" />
                Projeção de Necessidade de Caixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center p-6 bg-warning/10 rounded-xl border border-warning/20">
                  <p className="text-sm text-muted-foreground mb-2">7 dias</p>
                  <p className="text-3xl font-bold text-warning">{formatCurrency(projecoes.dias7)}</p>
                </div>
                <div className="text-center p-6 bg-primary/10 rounded-xl border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-2">15 dias</p>
                  <p className="text-3xl font-bold text-primary">{formatCurrency(projecoes.dias15)}</p>
                </div>
                <div className="text-center p-6 bg-success/10 rounded-xl border border-success/20">
                  <p className="text-sm text-muted-foreground mb-2">30 dias</p>
                  <p className="text-3xl font-bold text-success">{formatCurrency(projecoes.dias30)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs para visualização */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="resumo" className="gap-2">
                <Package className="h-4 w-4" />
                Resumo Geral
              </TabsTrigger>
              <TabsTrigger value="fornecedor" className="gap-2">
                <Building2 className="h-4 w-4" />
                Por Fornecedor
              </TabsTrigger>
              <TabsTrigger value="categoria" className="gap-2">
                <Tags className="h-4 w-4" />
                Por Categoria
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="mt-4">
              <Card>
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="flex items-center justify-between">
                    <span>Itens que Precisam de Atenção</span>
                    <Badge variant="outline">{itensAtencao.length} item(s)</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead>Insumo</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead className="text-right">Valor Estoque</TableHead>
                          <TableHead className="text-right">Valor Pto. Pedido</TableHead>
                          <TableHead className="text-right bg-success/10">Valor Reposição</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itensAtencao.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                              <Package className="h-12 w-12 mx-auto mb-3 text-success" />
                              <p className="font-medium text-success">Tudo sob controle!</p>
                              <p className="text-sm">Nenhum item precisa de atenção no momento.</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          itensAtencao.map(item => (
                            <TableRow key={item.id} className={`
                              ${item.status_estoque === 'Sem Estoque' ? 'bg-black/5' : ''}
                              ${item.status_estoque === 'Crítico' ? 'bg-destructive/5' : ''}
                              ${item.status_estoque === 'Atenção' ? 'bg-warning/5' : ''}
                            `}>
                              <TableCell>
                                <div>
                                  <span className="font-semibold">{item.nome_insumo}</span>
                                  <p className="text-xs text-muted-foreground">{item.codigo_insumo}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">{getStatusBadge(item.status_estoque)}</TableCell>
                              <TableCell>
                                <span className="text-sm">{item.fornecedor_padrao || 'Não definido'}</span>
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(item.valor_estoque_atual)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{formatCurrency(item.valor_ponto_pedido)}</TableCell>
                              <TableCell className="text-right bg-success/5 font-bold text-success">{formatCurrency(item.valor_reposicao)}</TableCell>
                            </TableRow>
                          ))
                        )}
                        {itensAtencao.length > 0 && (
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={5} className="text-right">Total Reposição:</TableCell>
                            <TableCell className="text-right text-success text-lg">{formatCurrency(kpis.valorReposicaoNecessaria)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fornecedor" className="mt-4 space-y-4">
              {porFornecedor.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-3 text-success" />
                    <p className="font-medium text-success">Nenhum pedido pendente</p>
                  </CardContent>
                </Card>
              ) : (
                porFornecedor.map(grupo => (
                  <Card key={grupo.nome}>
                    <CardHeader className="bg-muted/30 border-b">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-primary" />
                          <span>{grupo.nome}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{grupo.itens.length} item(s)</Badge>
                          <span className="text-lg font-bold text-success">{formatCurrency(grupo.total)}</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/10">
                            <TableHead>Insumo</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Qtd. Mín. Compra</TableHead>
                            <TableHead className="text-right">Custo Unit.</TableHead>
                            <TableHead className="text-right bg-success/10">Valor Reposição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grupo.itens.map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.nome_insumo}</TableCell>
                              <TableCell className="text-center">{getStatusBadge(item.status_estoque)}</TableCell>
                              <TableCell className="text-right">{item.quantidade_minima_compra} {item.unidade_medida}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.custo_unitario)}</TableCell>
                              <TableCell className="text-right font-bold text-success">{formatCurrency(item.valor_reposicao)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="categoria" className="mt-4 space-y-4">
              {porCategoria.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Tags className="h-12 w-12 mx-auto mb-3 text-success" />
                    <p className="font-medium text-success">Nenhum pedido pendente</p>
                  </CardContent>
                </Card>
              ) : (
                porCategoria.map(grupo => (
                  <Card key={grupo.nome}>
                    <CardHeader className="bg-muted/30 border-b">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tags className="h-5 w-5 text-primary" />
                          <span>{grupo.nome}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{grupo.itens.length} item(s)</Badge>
                          <span className="text-lg font-bold text-success">{formatCurrency(grupo.total)}</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/10">
                            <TableHead>Insumo</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead className="text-right bg-success/10">Valor Reposição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grupo.itens.map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.nome_insumo}</TableCell>
                              <TableCell className="text-center">{getStatusBadge(item.status_estoque)}</TableCell>
                              <TableCell>{item.fornecedor_padrao || 'Não definido'}</TableCell>
                              <TableCell className="text-right font-bold text-success">{formatCurrency(item.valor_reposicao)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </TooltipProvider>
    </Layout>
  );
}
