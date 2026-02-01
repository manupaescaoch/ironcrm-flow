import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Task, STATUS_CONFIG, PRIORIDADES } from '@/hooks/useTarefasData';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface TarefasExportProps {
  tasks: Task[];
  unidadeNome: string;
}

export function TarefasExport({ tasks, unidadeNome }: TarefasExportProps) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const getStatusLabel = (status: string) =>
    STATUS_CONFIG.find((s) => s.value === status)?.label || status;

  const getPrioridadeLabel = (prioridade: string) =>
    PRIORIDADES.find((p) => p.value === prioridade)?.label || prioridade;

  const prepareData = () => {
    return tasks.map((task) => ({
      Título: task.titulo,
      Descrição: task.descricao || '-',
      Responsável: task.responsavel,
      Setor: task.setor,
      Prioridade: getPrioridadeLabel(task.prioridade),
      Status: getStatusLabel(task.status),
      Prazo: task.prazo
        ? format(new Date(task.prazo), 'dd/MM/yyyy', { locale: ptBR })
        : '-',
      'Concluída em': task.concluida_em
        ? format(new Date(task.concluida_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })
        : '-',
      'Criado em': format(new Date(task.created_at), 'dd/MM/yyyy', { locale: ptBR }),
    }));
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const data = prepareData();

      // Header
      doc.setFontSize(18);
      doc.text('Relatório de Tarefas', 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Unidade: ${unidadeNome}`, 14, 30);
      doc.text(
        `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
        14,
        36
      );
      doc.text(`Total: ${tasks.length} tarefas`, 14, 42);

      // Table
      autoTable(doc, {
        startY: 48,
        head: [['Título', 'Responsável', 'Setor', 'Prioridade', 'Status', 'Prazo']],
        body: data.map((row) => [
          row['Título'],
          row['Responsável'],
          row['Setor'],
          row['Prioridade'],
          row['Status'],
          row['Prazo'],
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });

      doc.save(`tarefas-${unidadeNome.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      toast({
        title: 'PDF exportado',
        description: 'O relatório foi baixado com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o PDF.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const data = prepareData();

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tarefas');

      // Adjust column widths
      const colWidths = [
        { wch: 40 }, // Título
        { wch: 30 }, // Descrição
        { wch: 20 }, // Responsável
        { wch: 20 }, // Setor
        { wch: 10 }, // Prioridade
        { wch: 15 }, // Status
        { wch: 12 }, // Prazo
        { wch: 18 }, // Concluída em
        { wch: 12 }, // Criado em
      ];
      ws['!cols'] = colWidths;

      XLSX.writeFile(
        wb,
        `tarefas-${unidadeNome.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      );

      toast({
        title: 'Excel exportado',
        description: 'A planilha foi baixada com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar a planilha.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={exporting}>
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToPDF} className="gap-2">
          <FileDown className="w-4 h-4" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Exportar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
