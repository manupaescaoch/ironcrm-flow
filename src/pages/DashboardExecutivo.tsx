import { useEffect, useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Filter, FileDown, Save, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Hooks
import { useExecutivoData } from '@/hooks/useExecutivoData';
import { useExecutivoMetrics } from '@/hooks/useExecutivoMetrics';

// Components
import { ExecutivoKPIGrid } from '@/components/executivo/ExecutivoKPIGrid';
import { FunilExecutivoCard } from '@/components/executivo/FunilExecutivoCard';
import { OrigemLeadsCards } from '@/components/executivo/OrigemLeadsCards';
import { AgendaPresencaCard } from '@/components/executivo/AgendaPresencaCard';
import { PerformanceCadastradorCard, PerformanceFechadorCard } from '@/components/executivo/PerformanceCards';
import { TreinadorPerformanceCard } from '@/components/executivo/TreinadorPerformanceCard';
import { ResumoFinalCard } from '@/components/executivo/ResumoFinalCard';
import { EvolucaoCPLCPAChart } from '@/components/executivo/EvolucaoCPLCPAChart';

// Utils
import { formatExecutivoDate, formatExecutivoCurrency } from '@/utils/executivoMappers';

type PeriodPreset = 'currentMonth' | 'lastMonth' | 'last7days' | 'last30days' | 'custom';

const periodOptions: { value: PeriodPreset; label: string }[] = [
  { value: 'currentMonth', label: 'Mês Atual' },
  { value: 'lastMonth', label: 'Mês Anterior' },
  { value: 'last7days', label: 'Últimos 7 dias' },
  { value: 'last30days', label: 'Últimos 30 dias' },
  { value: 'custom', label: 'Período Customizado' },
];

function getPresetDates(preset: PeriodPreset): { start: string; end: string } {
  const today = new Date();
  switch (preset) {
    case 'currentMonth':
      return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
    case 'lastMonth': {
      const last = subMonths(today, 1);
      return { start: format(startOfMonth(last), 'yyyy-MM-dd'), end: format(endOfMonth(last), 'yyyy-MM-dd') };
    }
    case 'last7days':
      return { start: format(subDays(today, 7), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    case 'last30days':
      return { start: format(subDays(today, 30), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    default:
      return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
  }
}

export default function DashboardExecutivo() {
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  
  // Period preset
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('currentMonth');
  
  // Date filters
  const [dataInicio, setDataInicio] = useState<string>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [dataFim, setDataFim] = useState<string>(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );
  
  // Marketing investment for CPL/CPA calculation
  const [investimentoMarketing, setInvestimentoMarketing] = useState<number>(0);
  const [investimentoSalvo, setInvestimentoSalvo] = useState<number>(0);
  const [salvandoInvestimento, setSalvandoInvestimento] = useState(false);
  const [investimentoId, setInvestimentoId] = useState<string | null>(null);

  // Handle preset change
  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    if (preset !== 'custom') {
      const { start, end } = getPresetDates(preset);
      setDataInicio(start);
      setDataFim(end);
    }
  };

  // Data fetching
  const { leads, interacoes, loading, fetchData } = useExecutivoData();
  
  // Computed metrics
  const {
    topCards,
    funilExecutivo,
    origemData,
    agendaPresenca,
    performanceCadastrador,
    performanceFechador,
    performanceTreinadores,
    resumoFinal,
  } = useExecutivoMetrics(leads, interacoes);

  // Load saved investment for the selected period
  const loadInvestimento = useCallback(async () => {
    if (!unidadeAtual) return;
    
    const { data, error } = await supabase
      .from('investimentos_marketing')
      .select('id, valor')
      .eq('unidade_id', unidadeAtual.id)
      .eq('data_inicio', dataInicio)
      .eq('data_fim', dataFim)
      .maybeSingle();
    
    if (!error && data) {
      setInvestimentoMarketing(Number(data.valor));
      setInvestimentoSalvo(Number(data.valor));
      setInvestimentoId(data.id);
    } else {
      setInvestimentoMarketing(0);
      setInvestimentoSalvo(0);
      setInvestimentoId(null);
    }
  }, [dataInicio, dataFim, unidadeAtual]);

  // Save investment
  const salvarInvestimento = async () => {
    if (!unidadeAtual) return;
    
    setSalvandoInvestimento(true);
    try {
      if (investimentoId) {
        const { error } = await supabase
          .from('investimentos_marketing')
          .update({ valor: investimentoMarketing })
          .eq('id', investimentoId);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('investimentos_marketing')
          .insert({
            unidade_id: unidadeAtual.id,
            data_inicio: dataInicio,
            data_fim: dataFim,
            valor: investimentoMarketing,
          })
          .select('id')
          .single();
        
        if (error) throw error;
        setInvestimentoId(data.id);
      }
      
      setInvestimentoSalvo(investimentoMarketing);
      toast({ title: 'Investimento salvo com sucesso!' });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao salvar investimento', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setSalvandoInvestimento(false);
    }
  };

  useEffect(() => {
    fetchData(dataInicio, dataFim);
    loadInvestimento();
  }, [dataInicio, dataFim, fetchData, loadInvestimento]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 15;

    const primaryColor: [number, number, number] = [37, 99, 235];
    const greenColor: [number, number, number] = [22, 163, 74];
    const amberColor: [number, number, number] = [217, 119, 6];

    // Helper: section title
    const sectionTitle = (title: string) => {
      if (y > 260) { doc.addPage(); y = 15; }
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text(title, margin, y);
      y += 2;
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 7;
      doc.setTextColor(0, 0, 0);
    };

    // Helper: KPI box
    const drawKPIBox = (x: number, yPos: number, w: number, h: number, label: string, value: string, color: [number, number, number] = [0, 0, 0]) => {
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, yPos, w, h, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(label, x + w / 2, yPos + 10, { align: 'center' });
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(value, x + w / 2, yPos + 20, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    };

    const formatCurr = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const cpl = investimentoMarketing > 0 && topCards.leadsDoMes > 0 
      ? investimentoMarketing / topCards.leadsDoMes : null;
    const cpa = investimentoMarketing > 0 && topCards.matriculas > 0 
      ? investimentoMarketing / topCards.matriculas : null;

    // ==================== HEADER ====================
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Dashboard Executivo', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const unidadeLabel = unidadeAtual ? ` — ${unidadeAtual.nome}` : '';
    doc.text(`${formatExecutivoDate(dataInicio)} a ${formatExecutivoDate(dataFim)}${unidadeLabel}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setTextColor(0, 0, 0);

    // ==================== KPI ROW 1: Volume ====================
    const kpiW = (pageWidth - 2 * margin - 4 * 3) / 5;
    const kpiH = 26;
    const row1Data = [
      { label: 'Leads do Mês', value: topCards.leadsDoMes.toString() },
      { label: 'Agendamentos', value: topCards.agendamentos.toString() },
      { label: 'Comparecimentos', value: topCards.comparecimentos.toString() },
      { label: 'Matrículas', value: topCards.matriculas.toString(), color: greenColor },
      { label: 'Faturamento', value: formatCurr(topCards.faturamentoTotal), color: greenColor },
    ];
    row1Data.forEach((item, i) => {
      drawKPIBox(margin + i * (kpiW + 3), y, kpiW, kpiH, item.label, item.value, (item as any).color);
    });
    y += kpiH + 4;

    // ==================== KPI ROW 2: Conversão & Custo ====================
    const kpi2W = (pageWidth - 2 * margin - 5 * 3) / 6;
    const row2Data = [
      { label: 'Lead → Atend.', value: `${topCards.taxaLeadAtendimento.toFixed(1)}%` },
      { label: 'Atend. → Aluno', value: `${topCards.taxaConversao.toFixed(1)}%` },
      { label: 'CPL', value: cpl ? formatCurr(cpl) : '-', color: amberColor },
      { label: 'CPA', value: cpa ? formatCurr(cpa) : '-', color: [239, 68, 68] as [number, number, number] },
      { label: 'Ticket Médio', value: formatCurr(topCards.ticketMedio) },
      { label: 'LTV (8m)', value: formatCurr(topCards.ltv) },
    ];
    row2Data.forEach((item, i) => {
      drawKPIBox(margin + i * (kpi2W + 3), y, kpi2W, kpiH, item.label, item.value, (item as any).color);
    });
    y += kpiH + 10;

    // ==================== FUNIL EXECUTIVO ====================
    sectionTitle('Funil Executivo');
    autoTable(doc, {
      startY: y,
      head: [['Etapa', 'Quantidade', 'Conversão']],
      body: funilExecutivo.map(item => [
        item.etapa,
        item.quantidade.toString(),
        item.conversao !== null ? `${item.conversao.toFixed(1)}%` : '-'
      ]),
      theme: 'grid',
      headStyles: { fillColor: primaryColor, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ==================== CONVERSÃO POR ORIGEM ====================
    sectionTitle('Conversão por Origem');
    autoTable(doc, {
      startY: y,
      head: [['Origem', 'Leads', 'Matrículas', 'Conversão']],
      body: origemData.map(item => [
        item.origem,
        item.leads.toString(),
        item.matriculas.toString(),
        `${item.conversao.toFixed(1)}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: primaryColor, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ==================== AGENDA & PRESENÇA ====================
    sectionTitle('Agenda & Presença (No-Show)');
    // Summary boxes
    const sumW = (pageWidth - 2 * margin - 2 * 4) / 3;
    drawKPIBox(margin, y, sumW, 22, 'Média No-Show', `${agendaPresenca.mediaNoShow.toFixed(1)}%`, amberColor);
    drawKPIBox(margin + sumW + 4, y, sumW, 22, 'Melhor Dia', agendaPresenca.melhorDia ? formatExecutivoDate(agendaPresenca.melhorDia.data) : '-', greenColor);
    drawKPIBox(margin + 2 * (sumW + 4), y, sumW, 22, 'Pior Dia', agendaPresenca.piorDia ? formatExecutivoDate(agendaPresenca.piorDia.data) : '-', [239, 68, 68]);
    y += 28;

    if (agendaPresenca.rows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Agendados', 'Compareceram', 'No-Show (%)']],
        body: agendaPresenca.rows.slice(0, 15).map(row => [
          formatExecutivoDate(row.data),
          row.agendados.toString(),
          row.compareceram.toString(),
          `${row.noShow.toFixed(1)}%`
        ]),
        theme: 'grid',
        headStyles: { fillColor: primaryColor, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: margin, right: margin },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ==================== PERFORMANCE CADASTRADOR ====================
    if (y > 220) { doc.addPage(); y = 15; }
    sectionTitle('Performance por Cadastrador');
    autoTable(doc, {
      startY: y,
      head: [['Cadastrador', 'Leads', 'Agendamentos', 'Matrículas', 'Conversão']],
      body: performanceCadastrador.map((item, i) => [
        `${i === 0 && item.matriculas > 0 ? '🏆 ' : ''}${item.cadastrador}`,
        item.leads.toString(),
        item.agendamentos.toString(),
        item.matriculas.toString(),
        `${item.conversao.toFixed(1)}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: primaryColor, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ==================== PERFORMANCE FECHADOR ====================
    if (y > 220) { doc.addPage(); y = 15; }
    sectionTitle('Performance por Fechador');
    autoTable(doc, {
      startY: y,
      head: [['Fechador', 'Comparecimentos', 'Matrículas', 'Conversão', 'Valor Total']],
      body: performanceFechador.map((item, i) => [
        `${i === 0 && item.matriculas > 0 ? '🏆 ' : ''}${item.fechador}`,
        item.comparecimentos.toString(),
        item.matriculas.toString(),
        `${item.conversao.toFixed(1)}%`,
        formatCurr(item.valorTotal)
      ]),
      theme: 'grid',
      headStyles: { fillColor: primaryColor, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ==================== PERFORMANCE TREINADORES ====================
    if (y > 220) { doc.addPage(); y = 15; }
    sectionTitle('Performance dos Treinadores');
    autoTable(doc, {
      startY: y,
      head: [['Treinador', 'Aulas', 'Matrículas', 'Conversão', 'Bônus/Aluno', 'Bônus Total']],
      body: performanceTreinadores.map((item, i) => [
        `${i === 0 && item.matriculas > 0 ? '🏆 ' : ''}${item.treinador}`,
        item.aulas.toString(),
        item.matriculas.toString(),
        `${item.conversao.toFixed(1)}%`,
        formatCurr(item.bonusPorAluno),
        formatCurr(item.bonusTotal)
      ]),
      theme: 'grid',
      headStyles: { fillColor: primaryColor, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'right' } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Bonus rules
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text('Regras de Bônus: 1-4 matrículas: R$20/aluno | 5-7: R$25/aluno | 8-10: R$30/aluno | 11+: R$40/aluno', margin, y + 4);
    y += 12;

    // ==================== RESUMO FINAL ====================
    if (y > 220) { doc.addPage(); y = 15; }
    sectionTitle('Resumo Final do Mês');

    const resW = (pageWidth - 2 * margin - 3 * 3) / 4;
    const resH = 26;
    const resumoRow1 = [
      { label: 'Total de Leads', value: resumoFinal.totalLeads.toString() },
      { label: 'Total Agendamentos', value: resumoFinal.totalAgendamentos.toString() },
      { label: 'Total Comparecimentos', value: resumoFinal.totalComparecimentos.toString() },
      { label: 'Total Matrículas', value: resumoFinal.totalMatriculas.toString(), color: greenColor },
    ];
    resumoRow1.forEach((item, i) => {
      drawKPIBox(margin + i * (resW + 3), y, resW, resH, item.label, item.value, (item as any).color);
    });
    y += resH + 4;

    const resumoRow2 = [
      { label: 'Conversão Geral', value: `${resumoFinal.conversaoGeral.toFixed(1)}%` },
      { label: 'Média No-Show', value: `${resumoFinal.mediaNoShow.toFixed(1)}%`, color: amberColor },
      { label: 'Melhor Cadastrador', value: resumoFinal.melhorCadastrador },
      { label: 'Melhor Fechador', value: resumoFinal.melhorFechador },
    ];
    resumoRow2.forEach((item, i) => {
      drawKPIBox(margin + i * (resW + 3), y, resW, resH, item.label, item.value, (item as any).color);
    });
    y += resH + 4;

    // Melhor treinador centered
    const trW = (pageWidth - 2 * margin) / 2;
    drawKPIBox(pageWidth / 2 - trW / 2, y, trW, resH, 'Melhor Treinador', resumoFinal.melhorTreinador);
    y += resH + 8;

    // Footer
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, doc.internal.pageSize.getHeight() - 8);
      doc.text(`Página ${p}/${totalPages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    doc.save(`dashboard-executivo-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF exportado com sucesso!' });
  };

  return (
    <Layout>
      <div className="p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold">Dashboard Executivo</h1>
              <p className="text-sm text-muted-foreground">Pipeline de Aulas Experimentais</p>
            </div>
            {unidadeAtual && (
              <Badge variant="outline" className="text-sm font-medium px-3 py-1 bg-primary/10 text-primary border-primary/20">
                {unidadeAtual.nome}
              </Badge>
            )}
          </div>
          <Button onClick={exportPDF} disabled={loading}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-5 h-5" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={periodPreset} onValueChange={(v) => handlePresetChange(v as PeriodPreset)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {periodPreset === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Investimento Marketing (R$)</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    placeholder="Ex: 5000" 
                    value={investimentoMarketing || ''} 
                    onChange={(e) => setInvestimentoMarketing(Number(e.target.value) || 0)}
                    className="w-[150px]"
                  />
                  <Button 
                    variant={investimentoMarketing !== investimentoSalvo ? "default" : "outline"}
                    size="icon"
                    onClick={salvarInvestimento}
                    disabled={salvandoInvestimento || investimentoMarketing === investimentoSalvo}
                    title={investimentoMarketing === investimentoSalvo ? "Salvo" : "Salvar investimento"}
                  >
                    {salvandoInvestimento ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : investimentoMarketing === investimentoSalvo ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
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
            <ExecutivoKPIGrid topCards={topCards} investimentoMarketing={investimentoMarketing} />
            <EvolucaoCPLCPAChart />
            <FunilExecutivoCard funilData={funilExecutivo} />
            <OrigemLeadsCards origemData={origemData} />
            <AgendaPresencaCard agendaPresenca={agendaPresenca} />
            <PerformanceCadastradorCard data={performanceCadastrador} />
            <PerformanceFechadorCard data={performanceFechador} />
            <TreinadorPerformanceCard data={performanceTreinadores} />
            <ResumoFinalCard resumo={resumoFinal} />
          </>
        )}
      </div>
    </Layout>
  );
}
