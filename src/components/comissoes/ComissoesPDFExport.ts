import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  InteracaoComLead, 
  ComissaoAgrupada, 
  TreinadorBonus, 
  ComissaoStats, 
  TreinadorStats,
  MESES 
} from './constants';
import { formatComissaoCurrency, formatComissaoDate } from '@/utils/comissoesMappers';

interface ExportToPDFParams {
  mes: string;
  ano: string;
  stats: ComissaoStats;
  treinadorStats: TreinadorStats;
  totalComissoes: number;
  comissoesCadastrador: ComissaoAgrupada[];
  comissoesFechador: ComissaoAgrupada[];
  bonusTreinadores: TreinadorBonus[];
  filteredInteracoes: InteracaoComLead[];
}

export function exportComissoesToPDF({
  mes,
  ano,
  stats,
  treinadorStats,
  totalComissoes,
  comissoesCadastrador,
  comissoesFechador,
  bonusTreinadores,
  filteredInteracoes,
}: ExportToPDFParams): void {
  const doc = new jsPDF();
  const mesLabel = MESES.find(m => m.value === mes)?.label || mes;
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(18);
  doc.text(`Relatório de Comissões - ${mesLabel} ${ano}`, pageWidth / 2, 20, { align: 'center' });
  
  // Summary
  doc.setFontSize(12);
  doc.text('Resumo Geral', 14, 35);
  doc.setFontSize(10);
  doc.text(`Matrículas: ${stats.totalMatriculas}`, 14, 42);
  doc.text(`Ticket Médio: ${formatComissaoCurrency(stats.ticketMedio)}`, 14, 48);
  doc.text(`Total Cadastrador (3%): ${formatComissaoCurrency(stats.totalComissaoCadastrador)}`, 14, 54);
  doc.text(`Total Fechador (2%): ${formatComissaoCurrency(stats.totalComissaoFechador)}`, 14, 60);
  doc.text(`Total Bônus Treinador: ${formatComissaoCurrency(treinadorStats.totalBonus)}`, 14, 66);
  doc.text(`Total Comissões: ${formatComissaoCurrency(totalComissoes)}`, 14, 72);
  
  let yPos = 86;
  
  // Cadastrador Table
  if (comissoesCadastrador.length > 0) {
    doc.setFontSize(12);
    doc.text('Comissão do Cadastrador (3%)', 14, yPos);
    
    autoTable(doc, {
      startY: yPos + 5,
      head: [['Cadastrador', 'Matrículas', 'Comissão']],
      body: [
        ...comissoesCadastrador.map(item => [
          item.responsavel,
          item.matriculas.toString(),
          formatComissaoCurrency(item.comissao)
        ]),
        ['TOTAL', comissoesCadastrador.reduce((sum, i) => sum + i.matriculas, 0).toString(), formatComissaoCurrency(stats.totalComissaoCadastrador)]
      ],
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
      footStyles: { fontStyle: 'bold' },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Fechador Table
  if (comissoesFechador.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.text('Comissão do Fechador (2%)', 14, yPos);
    
    autoTable(doc, {
      startY: yPos + 5,
      head: [['Resp. Fechamento', 'Matrículas', 'Comissão']],
      body: [
        ...comissoesFechador.map(item => [
          item.responsavel,
          item.matriculas.toString(),
          formatComissaoCurrency(item.comissao)
        ]),
        ['TOTAL', comissoesFechador.reduce((sum, i) => sum + i.matriculas, 0).toString(), formatComissaoCurrency(stats.totalComissaoFechador)]
      ],
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Treinador Bonus Table
  if (bonusTreinadores.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.text('Bônus por Treinador Responsável', 14, yPos);
    
    autoTable(doc, {
      startY: yPos + 5,
      head: [['Treinador', 'Matrículas', 'Bônus Total']],
      body: [
        ...bonusTreinadores.map(item => [
          item.treinador,
          item.matriculas.toString(),
          formatComissaoCurrency(item.bonusTotal)
        ]),
        ['TOTAL', treinadorStats.totalMatriculas.toString(), formatComissaoCurrency(treinadorStats.totalBonus)]
      ],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Detailed Table
  if (filteredInteracoes.length > 0) {
    doc.addPage();
    doc.setFontSize(12);
    doc.text('Detalhamento das Matrículas', 14, 20);
    
    autoTable(doc, {
      startY: 25,
      head: [['Lead', 'Cadastrador', 'Plano', 'Valor', 'Cad. (3%)', 'Fech. (2%)', 'Resp. Fech.', 'Data']],
      body: filteredInteracoes.map(int => [
        int.lead_nome || '-',
        int.lead_cadastrado_por || '-',
        int.plano_escolhido || '-',
        formatComissaoCurrency(int.valor_plano || 0),
        formatComissaoCurrency(int.comissao_comercial || 0),
        formatComissaoCurrency(int.comissao_recepcao || 0),
        int.responsavel_fechamento || '-',
        formatComissaoDate(int.data_fechamento)
      ]),
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [100, 100, 100] },
    });
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `EVO TRAINING CLUB - Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(`comissoes_${mesLabel.toLowerCase()}_${ano}.pdf`);
}
