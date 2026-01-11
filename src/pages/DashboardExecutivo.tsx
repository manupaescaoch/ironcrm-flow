import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Filter, FileDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';

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

// Utils
import { formatExecutivoDate, formatExecutivoCurrency } from '@/utils/executivoMappers';

export default function DashboardExecutivo() {
  const { toast } = useToast();
  
  // Date filters
  const [dataInicio, setDataInicio] = useState<string>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [dataFim, setDataFim] = useState<string>(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );
  
  // Marketing investment for CPL/CPA calculation
  const [investimentoMarketing, setInvestimentoMarketing] = useState<number>(0);

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

  useEffect(() => {
    fetchData(dataInicio, dataFim);
  }, [dataInicio, dataFim, fetchData]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Dashboard Executivo', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${formatExecutivoDate(dataInicio)} a ${formatExecutivoDate(dataFim)}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Top Cards Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Geral', 14, yPos);
    yPos += 8;

    // Calculate CPL/CPA for PDF
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

    // Funil Executivo
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

    // Origem dos Leads
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

    // New page for more content
    doc.addPage();
    yPos = 20;

    // Performance por Cadastrador
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

    // Performance por Fechador
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

    // Performance Treinadores
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

    // Resumo Final
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

    // Save
    doc.save(`dashboard-executivo-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'PDF exportado com sucesso!' });
  };

  return (
    <Layout>
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Executivo</h1>
            <p className="text-sm text-muted-foreground">Pipeline de Aulas Experimentais</p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Investimento Marketing (R$)</Label>
                <Input 
                  type="number" 
                  placeholder="Ex: 5000" 
                  value={investimentoMarketing || ''} 
                  onChange={(e) => setInvestimentoMarketing(Number(e.target.value) || 0)}
                />
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
            {/* 1. TOP CARDS */}
            <ExecutivoKPIGrid topCards={topCards} investimentoMarketing={investimentoMarketing} />

            {/* 2. FUNIL EXECUTIVO */}
            <FunilExecutivoCard funilData={funilExecutivo} />

            {/* 3. ORIGEM DOS LEADS */}
            <OrigemLeadsCards origemData={origemData} />

            {/* 4. AGENDA & PRESENÇA */}
            <AgendaPresencaCard agendaPresenca={agendaPresenca} />

            {/* 5. PERFORMANCE POR CADASTRADOR */}
            <PerformanceCadastradorCard data={performanceCadastrador} />

            {/* 6. PERFORMANCE POR FECHADOR */}
            <PerformanceFechadorCard data={performanceFechador} />

            {/* 7. PERFORMANCE TREINADORES */}
            <TreinadorPerformanceCard data={performanceTreinadores} />

            {/* 8. RESUMO FINAL */}
            <ResumoFinalCard resumo={resumoFinal} />
          </>
        )}
      </div>
    </Layout>
  );
}
