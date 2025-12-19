import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Briefcase, 
  UserCheck, 
  FileDown,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown
} from 'lucide-react';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useUnidade } from '@/contexts/UnidadeContext';

interface EnrollmentRow {
  id: string;
  data_fechamento: string | null;
  lead_nome: string;
  lead_telefone: string | null;
  lead_origem: string | null;
  lead_cadastrado_por: string | null;
  atendido_por: string | null;
  responsavel_fechamento: string | null;
  treinador_responsavel: string | null;
  plano_escolhido: string | null;
  valor_plano: number;
  comissao_comercial: number;
  comissao_recepcao: number;
}

type SortField = 'data_fechamento' | 'lead_nome' | 'valor_plano' | 'responsavel_fechamento';
type SortDirection = 'asc' | 'desc';

const ROWS_PER_PAGE = 25;

export default function RelatorioVendas() {
  const [loading, setLoading] = useState(false);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();

  // Date filters
  const [dataInicial, setDataInicial] = useState<Date>(startOfMonth(new Date()));
  const [dataFinal, setDataFinal] = useState<Date>(endOfMonth(new Date()));

  // Optional filters
  const [filterAtendidoPor, setFilterAtendidoPor] = useState<string>('all');
  const [filterResponsavelFechamento, setFilterResponsavelFechamento] = useState<string>('all');
  const [filterTreinador, setFilterTreinador] = useState<string>('all');
  const [filterCadastrador, setFilterCadastrador] = useState<string>('all');
  const [filterOrigem, setFilterOrigem] = useState<string>('all');

  // Distinct values for filters
  const [distinctAtendidoPor, setDistinctAtendidoPor] = useState<string[]>([]);
  const [distinctResponsavel, setDistinctResponsavel] = useState<string[]>([]);
  const [distinctTreinador, setDistinctTreinador] = useState<string[]>([]);
  const [distinctOrigem, setDistinctOrigem] = useState<string[]>([]);
  const [distinctCadastrador, setDistinctCadastrador] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('data_fechamento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (unidadeAtual) {
      fetchEnrollments();
    }
  }, [dataInicial, dataFinal, unidadeAtual]);

  const fetchEnrollments = async () => {
    if (!unidadeAtual) return;
    setLoading(true);

    const startDateStr = format(dataInicial, 'yyyy-MM-dd');
    const endDateStr = format(dataFinal, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('interacoes')
      .select(`
        id,
        data_fechamento,
        atendido_por,
        responsavel_fechamento,
        treinador_responsavel,
        plano_escolhido,
        valor_plano,
        comissao_comercial,
        comissao_recepcao,
        leads(nome, telefone, origem, cadastrado_por)
      `)
      .eq('fechou_matricula', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_fechamento', startDateStr)
      .lte('data_fechamento', endDateStr)
      .order('data_fechamento', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const mapped: EnrollmentRow[] = (data || []).map((row: any) => ({
      id: row.id,
      data_fechamento: row.data_fechamento,
      lead_nome: row.leads?.nome || 'Lead não encontrado',
      lead_telefone: row.leads?.telefone || null,
      lead_origem: row.leads?.origem || null,
      lead_cadastrado_por: row.leads?.cadastrado_por || null,
      atendido_por: row.atendido_por,
      responsavel_fechamento: row.responsavel_fechamento,
      treinador_responsavel: row.treinador_responsavel,
      plano_escolhido: row.plano_escolhido,
      valor_plano: row.valor_plano || 0,
      comissao_comercial: row.comissao_comercial || 0,
      comissao_recepcao: row.comissao_recepcao || 0,
    }));

    setEnrollments(mapped);

    // Extract distinct values for filters
    const atendidos = [...new Set(mapped.map(e => e.atendido_por).filter(Boolean))] as string[];
    const responsaveis = [...new Set(mapped.map(e => e.responsavel_fechamento).filter(Boolean))] as string[];
    const treinadores = [...new Set(mapped.map(e => e.treinador_responsavel).filter(Boolean))] as string[];
    const origens = [...new Set(mapped.map(e => e.lead_origem).filter(Boolean))] as string[];
    const cadastradores = [...new Set(mapped.map(e => e.lead_cadastrado_por).filter(Boolean))] as string[];

    setDistinctAtendidoPor(atendidos.sort());
    setDistinctResponsavel(responsaveis.sort());
    setDistinctTreinador(treinadores.sort());
    setDistinctOrigem(origens.sort());
    setDistinctCadastrador(cadastradores.sort());

    setCurrentPage(1);
    setLoading(false);
  };

  // Filter enrollments
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter(e => {
      if (filterAtendidoPor !== 'all' && e.atendido_por !== filterAtendidoPor) return false;
      if (filterResponsavelFechamento !== 'all' && e.responsavel_fechamento !== filterResponsavelFechamento) return false;
      if (filterTreinador !== 'all' && e.treinador_responsavel !== filterTreinador) return false;
      if (filterOrigem !== 'all' && e.lead_origem !== filterOrigem) return false;
      if (filterCadastrador !== 'all' && e.lead_cadastrado_por !== filterCadastrador) return false;
      return true;
    });
  }, [enrollments, filterAtendidoPor, filterResponsavelFechamento, filterTreinador, filterOrigem, filterCadastrador]);

  // Sort enrollments
  const sortedEnrollments = useMemo(() => {
    const sorted = [...filteredEnrollments];
    sorted.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'data_fechamento') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else if (sortField === 'valor_plano') {
        aVal = aVal || 0;
        bVal = bVal || 0;
      } else {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredEnrollments, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedEnrollments.length / ROWS_PER_PAGE);
  const paginatedEnrollments = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return sortedEnrollments.slice(start, start + ROWS_PER_PAGE);
  }, [sortedEnrollments, currentPage]);

  // Stats - use same calculation as Comissoes page
  const stats = useMemo(() => {
    const totalMatriculas = filteredEnrollments.length;
    const totalValorPlano = filteredEnrollments.reduce((sum, e) => sum + e.valor_plano, 0);
    const totalComissaoComercial = filteredEnrollments.reduce((sum, e) => sum + e.comissao_comercial, 0);
    const totalComissaoRecepcao = filteredEnrollments.reduce((sum, e) => sum + e.comissao_recepcao, 0);

    return {
      totalMatriculas,
      totalValorPlano,
      totalComissaoComercial,
      totalComissaoRecepcao,
    };
  }, [filteredEnrollments]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  // PDF Export
  const exportToPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('IRON CLUB - Relatório de Vendas', pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodText = `Período: ${format(dataInicial, 'dd/MM/yyyy')} a ${format(dataFinal, 'dd/MM/yyyy')}`;
    doc.text(periodText, pageWidth / 2, 22, { align: 'center' });

    const generatedText = `Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`;
    doc.text(generatedText, pageWidth / 2, 28, { align: 'center' });

    // Summary
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo:', 14, 38);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Matrículas no período: ${stats.totalMatriculas}`, 14, 44);
    doc.text(`Faturamento total: ${formatCurrency(stats.totalValorPlano)}`, 14, 50);
    doc.text(`Comissão Comercial: ${formatCurrency(stats.totalComissaoComercial)}`, 100, 44);
    doc.text(`Comissão Recepção: ${formatCurrency(stats.totalComissaoRecepcao)}`, 100, 50);

    // Table
    const tableData = sortedEnrollments.map(e => [
      formatDate(e.data_fechamento),
      e.lead_nome,
      e.lead_telefone || '-',
      e.lead_origem || '-',
      e.lead_cadastrado_por || '-',
      e.atendido_por || '-',
      e.responsavel_fechamento || '-',
      e.treinador_responsavel || '-',
      e.plano_escolhido || '-',
      formatCurrency(e.valor_plano),
      formatCurrency(e.comissao_comercial),
      formatCurrency(e.comissao_recepcao),
    ]);

    autoTable(doc, {
      startY: 58,
      head: [[
        'Data',
        'Lead',
        'Telefone',
        'Origem',
        'Cadastrador',
        'Atendido por',
        'Resp. Fechamento',
        'Treinador',
        'Plano',
        'Valor',
        'Com. Cad. (3%)',
        'Com. Fech. (2%)',
      ]],
      body: tableData,
      foot: [[
        'TOTAL',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        formatCurrency(stats.totalValorPlano),
        formatCurrency(stats.totalComissaoComercial),
        formatCurrency(stats.totalComissaoRecepcao),
      ]],
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [236, 240, 241],
        textColor: 0,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      margin: { left: 10, right: 10 },
      didDrawPage: (data) => {
        // Page number
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      },
    });

    doc.save(`relatorio-vendas-${format(dataInicial, 'yyyy-MM-dd')}-${format(dataFinal, 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF exportado com sucesso!' });
  };

  return (
    <Layout>
      <div className="p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Relatório de Vendas</h1>

        {/* Filters */}
        <Card className="mb-6 md:mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Data Inicial */}
              <div className="space-y-2">
                <Label>Data inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dataInicial && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataInicial ? format(dataInicial, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataInicial}
                      onSelect={(date) => date && setDataInicial(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Data Final */}
              <div className="space-y-2">
                <Label>Data final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dataFinal && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataFinal ? format(dataFinal, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataFinal}
                      onSelect={(date) => date && setDataFinal(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Atendido por */}
              <div className="space-y-2">
                <Label>Atendido por</Label>
                <Select value={filterAtendidoPor} onValueChange={setFilterAtendidoPor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {distinctAtendidoPor.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Responsável fechamento */}
              <div className="space-y-2">
                <Label>Resp. fechamento</Label>
                <Select value={filterResponsavelFechamento} onValueChange={setFilterResponsavelFechamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {distinctResponsavel.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Treinador */}
              <div className="space-y-2">
                <Label>Treinador</Label>
                <Select value={filterTreinador} onValueChange={setFilterTreinador}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {distinctTreinador.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Origem */}
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {distinctOrigem.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cadastrador */}
              <div className="space-y-2">
                <Label>Cadastrador</Label>
                <Select value={filterCadastrador} onValueChange={setFilterCadastrador}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {distinctCadastrador.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 md:mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Matrículas no período</p>
                      <p className="text-2xl font-bold">{stats.totalMatriculas}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Faturamento total</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalValorPlano)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Comissão Comercial</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalComissaoComercial)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Comissão Recepção</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalComissaoRecepcao)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Export Button + Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Detalhamento de Vendas</CardTitle>
                <Button onClick={exportToPDF} className="gap-2">
                  <FileDown className="w-4 h-4" />
                  Exportar PDF
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <SortableHeader field="data_fechamento">Data</SortableHeader>
                        <SortableHeader field="lead_nome">Lead</SortableHeader>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Cadastrador</TableHead>
                        <TableHead>Atendido por</TableHead>
                        <SortableHeader field="responsavel_fechamento">Resp. Fechamento</SortableHeader>
                        <TableHead>Treinador</TableHead>
                        <TableHead>Plano</TableHead>
                        <SortableHeader field="valor_plano">Valor (R$)</SortableHeader>
                        <TableHead className="text-right">Com. Cad. (3%)</TableHead>
                        <TableHead className="text-right">Com. Fech. (2%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEnrollments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                            Nenhuma matrícula encontrada no período selecionado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {paginatedEnrollments.map((enrollment, index) => (
                            <TableRow key={enrollment.id} className={index % 2 === 0 ? '' : 'bg-muted/30'}>
                              <TableCell>{formatDate(enrollment.data_fechamento)}</TableCell>
                              <TableCell className="font-medium">{enrollment.lead_nome}</TableCell>
                              <TableCell><WhatsAppLink phone={enrollment.lead_telefone} /></TableCell>
                              <TableCell>{enrollment.lead_origem || '-'}</TableCell>
                              <TableCell>{enrollment.lead_cadastrado_por || '-'}</TableCell>
                              <TableCell>{enrollment.atendido_por || '-'}</TableCell>
                              <TableCell>{enrollment.responsavel_fechamento || '-'}</TableCell>
                              <TableCell>{enrollment.treinador_responsavel || '-'}</TableCell>
                              <TableCell>{enrollment.plano_escolhido || '-'}</TableCell>
                              <TableCell className="font-medium">{formatCurrency(enrollment.valor_plano)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatCurrency(enrollment.comissao_comercial)}</TableCell>
                              <TableCell className="text-right text-amber-600">{formatCurrency(enrollment.comissao_recepcao)}</TableCell>
                            </TableRow>
                          ))}
                          {/* Totals Row */}
                          <TableRow className="bg-muted/50 font-bold border-t-2">
                            <TableCell colSpan={9}>TOTAL</TableCell>
                            <TableCell>{formatCurrency(stats.totalValorPlano)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(stats.totalComissaoComercial)}</TableCell>
                            <TableCell className="text-right text-amber-600">{formatCurrency(stats.totalComissaoRecepcao)}</TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {((currentPage - 1) * ROWS_PER_PAGE) + 1} a {Math.min(currentPage * ROWS_PER_PAGE, sortedEnrollments.length)} de {sortedEnrollments.length} registros
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="px-4 text-sm">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
