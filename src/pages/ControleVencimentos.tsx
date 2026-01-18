import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, AlertTriangle, Clock, CheckCircle2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVencimentosData, VencimentosFilters as FiltersType } from '@/hooks/useVencimentosData';
import { VencimentosTable } from '@/components/vencimentos/VencimentosTable';
import { VencimentosFilters } from '@/components/vencimentos/VencimentosFilters';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ControleVencimentos() {
  const [filters, setFilters] = useState<FiltersType>({ status: 'todos', plano: 'todos' });
  const { vencimentos, summary, planosDisponiveis, isLoading, refetch } = useVencimentosData(filters);

  const handleExportExcel = () => {
    const exportData = vencimentos.map((item) => ({
      Nome: item.nome,
      Telefone: item.telefone || '',
      Email: item.email || '',
      Plano: item.planoEscolhido,
      'Data Fechamento': format(item.dataFechamento, 'dd/MM/yyyy', { locale: ptBR }),
      'Data Vencimento': format(item.dataVencimento, 'dd/MM/yyyy', { locale: ptBR }),
      'Dias Restantes': item.diasRestantes,
      Status: item.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vencimentos');
    XLSX.writeFile(workbook, `vencimentos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const kpiCards = [
    { label: 'Vencidos', value: summary.vencidos, icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
    { label: 'Urgente (7d)', value: summary.urgentes, icon: Clock, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { label: 'Atenção (15d)', value: summary.atencao, icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-500/10' },
    { label: 'Próximo (30d)', value: summary.proximos, icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: 'OK (+30d)', value: summary.ok, icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Controle de Vencimentos</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie os vencimentos de planos dos alunos
              </p>
            </div>
          </div>

          <Button onClick={handleExportExcel} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className={cn('cursor-pointer hover:shadow-md transition-shadow')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', card.bgColor)}>
                      <Icon className={cn('h-5 w-5', card.color)} />
                    </div>
                    <div>
                      <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <VencimentosFilters
              filters={filters}
              onFiltersChange={setFilters}
              planosDisponiveis={planosDisponiveis}
            />
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Lista de Vencimentos</span>
              <span className="text-sm font-normal text-muted-foreground">
                {vencimentos.length} {vencimentos.length === 1 ? 'aluno' : 'alunos'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VencimentosTable vencimentos={vencimentos} isLoading={isLoading} onRefresh={refetch} />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
