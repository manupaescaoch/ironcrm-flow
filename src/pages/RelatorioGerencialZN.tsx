import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  AlertTriangle, 
  Crown, 
  PauseCircle,
  Pencil,
  Percent,
  Clock,
  XCircle,
  Banknote,
  RefreshCw,
  Plus,
  FileDown,
  Loader2
} from 'lucide-react';
import { format, parse, startOfMonth, endOfMonth, isWithinInterval, compareAsc } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { AdicionarMesModal } from '@/components/relatorio-gerencial/AdicionarMesModal';
import { KPICard } from '@/components/relatorio-gerencial/KPICard';
import { GraficosRelatorio } from '@/components/relatorio-gerencial/GraficosRelatorio';
import { TabelaHistorico } from '@/components/relatorio-gerencial/TabelaHistorico';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RelatorioMes {
  id: string;
  mes_ano: string;
  ativos: number;
  adimplentes: number;
  inadimplentes: number;
  vip: number;
  suspensos: number;
  cancelamentos: number;
  renovacoes: number;
  total_a_vencer: number | null;
  churn_percentual: number;
  tempo_medio_vida: number;
  ticket_medio: number;
  observacoes: string | null;
  capacidade_zn: number;
  created_at: string;
  updated_at: string;
}

function generateMonthOptions() {
  const options: string[] = [];
  const now = new Date();
  for (let i = 24; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(format(date, 'yyyy-MM'));
  }
  return options;
}

export default function RelatorioGerencialZN() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const [mesInicial, setMesInicial] = useState(monthOptions[Math.max(0, monthOptions.length - 6)]);
  const [mesFinal, setMesFinal] = useState(monthOptions[monthOptions.length - 1]);
  const [filtroAplicado, setFiltroAplicado] = useState({ mesInicial: mesInicial, mesFinal: mesFinal });
  const [modalAberto, setModalAberto] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RelatorioMes | null>(null);

  // Fetch all reports
  const { data: relatorios = [], isLoading } = useQuery({
    queryKey: ['relatorio-gerencial-zn'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relatorio_gerencial_zn')
        .select('*')
        .order('mes_ano', { ascending: true });
      
      if (error) throw error;
      return data as RelatorioMes[];
    }
  });

  // Filter reports by selected period
  const relatoriosFiltrados = useMemo(() => {
    if (!relatorios.length) return [];
    
    return relatorios.filter(r => {
      return r.mes_ano >= filtroAplicado.mesInicial && r.mes_ano <= filtroAplicado.mesFinal;
    }).sort((a, b) => compareAsc(
      parse(a.mes_ano, 'yyyy-MM', new Date()),
      parse(b.mes_ano, 'yyyy-MM', new Date())
    ));
  }, [relatorios, filtroAplicado]);

  // Get the most recent month data for KPIs
  const mesAtual = relatoriosFiltrados[relatoriosFiltrados.length - 1];
  const mesAnterior = relatoriosFiltrados[relatoriosFiltrados.length - 2];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('relatorio_gerencial_zn')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatorio-gerencial-zn'] });
      toast({ title: 'Registro excluído com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir registro', variant: 'destructive' });
    }
  });

  const handleAplicarFiltros = () => {
    if (mesInicial > mesFinal) {
      toast({ title: 'Mês inicial não pode ser posterior ao mês final', variant: 'destructive' });
      return;
    }
    setFiltroAplicado({ mesInicial, mesFinal });
  };

  const handleExportPDF = () => {
    if (!relatoriosFiltrados.length) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.text('Relatório Gerencial - Zona Norte', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Período: ${formatMesAno(filtroAplicado.mesInicial)} a ${formatMesAno(filtroAplicado.mesFinal)}`, pageWidth / 2, 30, { align: 'center' });
    
    if (mesAtual) {
      doc.setFontSize(14);
      doc.text(`KPIs - ${formatMesAno(mesAtual.mes_ano)}`, 14, 45);
      
      const kpiData = [
        ['Ativos', mesAtual.ativos.toString()],
        ['Adimplentes', mesAtual.adimplentes.toString()],
        ['Inadimplentes', mesAtual.inadimplentes.toString()],
        ['VIP', mesAtual.vip.toString()],
        ['Suspensos', mesAtual.suspensos.toString()],
        ['Churn (%)', `${mesAtual.churn_percentual}%`],
        ['Tempo Médio de Vida', `${mesAtual.tempo_medio_vida} meses`],
        ['Cancelamentos', mesAtual.cancelamentos.toString()],
        ['Renovações', mesAtual.renovacoes.toString()],
        ['Ocupação (%)', `${(((mesAtual.ativos + mesAtual.vip) / mesAtual.capacidade_zn) * 100).toFixed(1)}%`],
        ['Ticket Médio', `R$ ${mesAtual.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ];
      
      autoTable(doc, {
        startY: 50,
        head: [['Indicador', 'Valor']],
        body: kpiData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });
    }

    // Historical table
    const tableStartY = (doc as any).lastAutoTable?.finalY + 15 || 120;
    doc.setFontSize(14);
    doc.text('Histórico Mensal', 14, tableStartY);
    
    const tableData = relatoriosFiltrados.map(r => [
      formatMesAno(r.mes_ano),
      r.ativos.toString(),
      r.inadimplentes.toString(),
      r.vip.toString(),
      `${r.churn_percentual}%`,
      `${r.tempo_medio_vida}`,
      r.cancelamentos.toString(),
      r.renovacoes.toString()
    ]);

    autoTable(doc, {
      startY: tableStartY + 5,
      head: [['Mês', 'Ativos', 'Inadimp.', 'VIP', 'Churn', 'Tempo Vida', 'Cancel.', 'Renov.']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 },
    });

    doc.save(`relatorio-gerencial-zn-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF exportado com sucesso' });
  };

  const handleEdit = (record: RelatorioMes) => {
    setEditingRecord(record);
    setModalAberto(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setModalAberto(false);
    setEditingRecord(null);
  };

  // Calculate variations
  const calcVariacao = (atual: number | undefined, anterior: number | undefined) => {
    if (atual === undefined || anterior === undefined || anterior === 0) return null;
    const diff = atual - anterior;
    const percentual = ((diff / anterior) * 100).toFixed(1);
    return { diff, percentual: parseFloat(percentual) };
  };

  // Get last update
  const ultimaAtualizacao = mesAtual ? new Date(mesAtual.updated_at) : null;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatório Gerencial – Zona Norte</h1>
            <p className="text-muted-foreground">Análise mensal de indicadores da unidade ZN</p>
            {ultimaAtualizacao && (
              <p className="text-xs text-muted-foreground mt-1">
                Última atualização: {format(ultimaAtualizacao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <>
                <Button onClick={() => setModalAberto(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar mês
                </Button>
                {relatorios.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Pencil className="w-4 h-4" />
                        Editar mês
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {relatorios.slice().reverse().map((r) => (
                        <DropdownMenuItem key={r.id} onClick={() => handleEdit(r)}>
                          {formatMesAno(r.mes_ano)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
            <Button variant="outline" onClick={handleExportPDF} className="gap-2">
              <FileDown className="w-4 h-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">Unidade</label>
                <Select value="zn" disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="Zona Norte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zn">Zona Norte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">Mês Inicial</label>
                <Select value={mesInicial} onValueChange={setMesInicial}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m} value={m}>{formatMesAno(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">Mês Final</label>
                <Select value={mesFinal} onValueChange={setMesFinal}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m} value={m}>{formatMesAno(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAplicarFiltros}>Aplicar filtros</Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : relatoriosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhum dado encontrado para o período selecionado.</p>
              {isAdmin && (
                <Button onClick={() => setModalAberto(true)} className="mt-4 gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar primeiro mês
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI Cards */}
            {mesAtual && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                <KPICard
                  title="Ativos"
                  value={mesAtual.ativos}
                  icon={Users}
                  variacao={calcVariacao(mesAtual.ativos, mesAnterior?.ativos)}
                />
                <KPICard
                  title="Adimplentes"
                  value={mesAtual.adimplentes}
                  icon={Users}
                  variacao={calcVariacao(mesAtual.adimplentes, mesAnterior?.adimplentes)}
                  color="green"
                />
                <KPICard
                  title="Inadimplentes"
                  value={mesAtual.inadimplentes}
                  icon={AlertTriangle}
                  variacao={calcVariacao(mesAtual.inadimplentes, mesAnterior?.inadimplentes)}
                  color="red"
                  invertVariacao
                />
                <KPICard
                  title="VIP"
                  value={mesAtual.vip}
                  icon={Crown}
                  variacao={calcVariacao(mesAtual.vip, mesAnterior?.vip)}
                  color="amber"
                />
                <KPICard
                  title="Suspensos"
                  value={mesAtual.suspensos}
                  icon={PauseCircle}
                  variacao={calcVariacao(mesAtual.suspensos, mesAnterior?.suspensos)}
                  invertVariacao
                />
                <KPICard
                  title="Churn"
                  value={`${mesAtual.churn_percentual}%`}
                  icon={Percent}
                  variacao={calcVariacao(mesAtual.churn_percentual, mesAnterior?.churn_percentual)}
                  color="red"
                  invertVariacao
                />
                <KPICard
                  title="Tempo Médio de Vida"
                  value={`${mesAtual.tempo_medio_vida} meses`}
                  icon={Clock}
                  variacao={calcVariacao(mesAtual.tempo_medio_vida, mesAnterior?.tempo_medio_vida)}
                />
                <KPICard
                  title="Cancelamentos"
                  value={mesAtual.cancelamentos}
                  icon={XCircle}
                  variacao={calcVariacao(mesAtual.cancelamentos, mesAnterior?.cancelamentos)}
                  color="red"
                  invertVariacao
                />
                <KPICard
                  title="Renovações"
                  value={mesAtual.renovacoes}
                  icon={RefreshCw}
                  variacao={calcVariacao(mesAtual.renovacoes, mesAnterior?.renovacoes)}
                  color="green"
                />
                <KPICard
                  title="Ocupação"
                  value={`${(((mesAtual.ativos + mesAtual.vip) / mesAtual.capacidade_zn) * 100).toFixed(1)}%`}
                  icon={Users}
                  subtitle={`${mesAtual.capacidade_zn - (mesAtual.ativos + mesAtual.vip)} vagas disponíveis de ${mesAtual.capacidade_zn}`}
                />
                <KPICard
                  title="Ticket Médio"
                  value={`R$ ${mesAtual.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={Banknote}
                  variacao={calcVariacao(mesAtual.ticket_medio, mesAnterior?.ticket_medio)}
                  color="green"
                />
              </div>
            )}

            {/* Charts - only show if 2+ months */}
            {relatoriosFiltrados.length >= 2 && (
              <GraficosRelatorio dados={relatoriosFiltrados} />
            )}

            {/* Historical Table */}
            <TabelaHistorico 
              dados={relatoriosFiltrados} 
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </>
        )}

        {/* Modal */}
        <AdicionarMesModal
          open={modalAberto}
          onClose={handleCloseModal}
          editingRecord={editingRecord}
          existingMonths={relatorios.map(r => r.mes_ano)}
        />
      </div>
    </Layout>
  );
}

function formatMesAno(mesAno: string): string {
  const date = parse(mesAno, 'yyyy-MM', new Date());
  return format(date, 'MMM/yyyy', { locale: ptBR });
}
