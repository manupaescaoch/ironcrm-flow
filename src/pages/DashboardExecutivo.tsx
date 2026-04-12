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
    let yPos = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Dashboard Executivo', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const unidadeLabel = unidadeAtual ? ` | ${unidadeAtual.nome}` : '';
    doc.text(`Período: ${formatExecutivoDate(dataInicio)} a ${formatExecutivoDate(dataFim)}${unidadeLabel}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Geral', 14, yPos);
    yPos += 8;

    const cpl = investimentoMarketing > 0 && topCards.leadsDoMes > 0 
      ? investimentoMarketing / topCards.leadsDoMes 
      : null;
    const cpa = investimentoMarketing > 0 && topCards.matriculas > 0 
      ? investimentoMarketing / topCards.matriculas 
      : null;

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor']],
      body: [
        ['Leads do Mês', topCards.leadsDoMes.toString()],
        ['Agendamentos', topCards.agendamentos.toString()],
        ['Comparecimentos', topCards.comparecimentos.toString()],
        ['Matrículas', topCards.matriculas.toString()],
        ['Faturamento', formatExecutivoCurrency(topCards.faturamentoTotal)],
        ['Taxa Lead → Atendimento', `${topCards.taxaLeadAtendimento.toFixed(1)}%`],
        ['Taxa Atendimento → Aluno', `${topCards.taxaConversao.toFixed(1)}%`],
        ['CPL (Custo por Lead)', cpl ? formatExecutivoCurrency(cpl) : 'N/A'],
        ['CPA (Custo por Aquisição)', cpa ? formatExecutivoCurrency(cpa) : 'N/A'],
        ['Ticket Médio', formatExecutivoCurrency(topCards.ticketMedio)],
        ['LTV (8 meses)', formatExecutivoCurrency(topCards.ltv)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Funil Executivo', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Etapa', 'Quantidade', 'Conversão']],
      body: funilExecutivo.map(item => [
        item.etapa,
        item.quantidade,
        item.conversao !== null ? `${item.conversao.toFixed(1)}%` : '-'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Conversão por Origem', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Origem', 'Leads', 'Matrículas', 'Conversão']],
      body: origemData.map(item => [
        item.origem,
        item.leads,
        item.matriculas,
        `${item.conversao.toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.addPage();
    yPos = 20;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance por Cadastrador', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Cadastrador', 'Leads', 'Agendamentos', 'Matrículas', 'Conversão']],
      body: performanceCadastrador.map(item => [
        item.cadastrador,
        item.leads,
        item.agendamentos,
        item.matriculas,
        `${item.conversao.toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance por Fechador', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Fechador', 'Comparecimentos', 'Matrículas', 'Conversão', 'Valor Total']],
      body: performanceFechador.map(item => [
        item.fechador,
        item.comparecimentos,
        item.matriculas,
        `${item.conversao.toFixed(1)}%`,
        formatExecutivoCurrency(item.valorTotal)
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Performance dos Treinadores', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Treinador', 'Aulas', 'Matrículas', 'Conversão', 'Bônus/Aluno', 'Bônus Total']],
      body: performanceTreinadores.map(item => [
        item.treinador,
        item.aulas,
        item.matriculas,
        `${item.conversao.toFixed(1)}%`,
        formatExecutivoCurrency(item.bonusPorAluno),
        formatExecutivoCurrency(item.bonusTotal)
      ]),
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Final do Mês', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de Leads', resumoFinal.totalLeads],
        ['Total Agendamentos', resumoFinal.totalAgendamentos],
        ['Total Comparecimentos', resumoFinal.totalComparecimentos],
        ['Total Matrículas', resumoFinal.totalMatriculas],
        ['Conversão Geral', `${resumoFinal.conversaoGeral.toFixed(1)}%`],
        ['Média No-Show', `${resumoFinal.mediaNoShow.toFixed(1)}%`],
        ['Melhor Cadastrador', resumoFinal.melhorCadastrador],
        ['Melhor Fechador', resumoFinal.melhorFechador],
        ['Melhor Treinador', resumoFinal.melhorTreinador],
      ],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
    });

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
