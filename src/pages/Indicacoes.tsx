import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Users, Gift, Info, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Helmet } from 'react-helmet';
import { useToast } from '@/hooks/use-toast';
import { useUnidade } from '@/contexts/UnidadeContext';

type PeriodFilter = 'all' | 'current_month' | 'previous_month' | 'custom';

interface Indicacao {
  id: string;
  quem_indicou: string;
  lead_id: string;
  lead_nome: string;
  data_fechamento: string | null;
  data_interacao: string;
  fechou_matricula: boolean;
}

export default function Indicacoes() {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  
  // Edit/Delete state
  const [editingIndicacao, setEditingIndicacao] = useState<Indicacao | null>(null);
  const [deletingIndicacao, setDeletingIndicacao] = useState<Indicacao | null>(null);
  const [editQuemIndicou, setEditQuemIndicou] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();

  // Calculate date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case 'all':
        return null; // No date filter
      case 'current_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'previous_month':
        const prevMonth = subMonths(now, 1);
        return { start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
      case 'custom':
        return { 
          start: customStartDate || startOfMonth(now), 
          end: customEndDate || endOfMonth(now) 
        };
      default:
        return null;
    }
  }, [periodFilter, customStartDate, customEndDate]);

  // Fetch ALL indicações for global total (not affected by filter)
  const { data: allIndicacoes = [] } = useQuery({
    queryKey: ['indicacoes-total', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('interacoes')
        .select('id, lead_id, quem_indicou, fechou_matricula')
        .eq('unidade_id', unidadeAtual.id)
        .not('quem_indicou', 'is', null)
        .neq('quem_indicou', '');

      if (error) throw error;
      return data || [];
    },
    enabled: !!unidadeAtual,
  });

  // Fetch indicações filtered by period (for table and period KPIs)
  const { data: indicacoes = [], isLoading } = useQuery({
    queryKey: ['indicacoes-periodo', dateRange?.start, dateRange?.end, unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      let query = supabase
        .from('interacoes')
        .select(`
          id,
          quem_indicou,
          lead_id,
          data_fechamento,
          data_interacao,
          fechou_matricula,
          leads!inner(nome)
        `)
        .eq('unidade_id', unidadeAtual.id)
        .not('quem_indicou', 'is', null)
        .neq('quem_indicou', '');

      // Apply date filter only if dateRange is set
      if (dateRange) {
        const startStr = format(dateRange.start, 'yyyy-MM-dd');
        const endStr = format(dateRange.end, 'yyyy-MM-dd');
        query = query
          .gte('data_interacao', startStr)
          .lte('data_interacao', endStr + 'T23:59:59');
      }

      const { data, error } = await query.order('data_interacao', { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        quem_indicou: item.quem_indicou,
        lead_id: item.lead_id,
        lead_nome: item.leads?.nome || 'Desconhecido',
        data_fechamento: item.data_fechamento,
        data_interacao: item.data_interacao,
        fechou_matricula: item.fechou_matricula || false,
      })) as Indicacao[];
    },
    enabled: !!unidadeAtual,
  });

  // Global metrics (not affected by filter) - count unique leads
  const totalIndicacoesCRM = allIndicacoes.length;
  const indicacoesConfirmadasCRM = new Set(allIndicacoes.filter(i => i.fechou_matricula).map(i => i.lead_id)).size;

  // Period metrics (affected by filter) - count unique leads
  const totalIndicacoesPeriodo = indicacoes.length;
  const indicacoesConfirmadasPeriodo = new Set(indicacoes.filter(i => i.fechou_matricula).map(i => i.lead_id)).size;

  // Group by quem_indicou for summary - count unique leads
  const indicadoresSummary = useMemo(() => {
    const summary: Record<string, { totalSet: Set<string>; confirmadasSet: Set<string> }> = {};
    indicacoes.forEach(ind => {
      if (!summary[ind.quem_indicou]) {
        summary[ind.quem_indicou] = { totalSet: new Set(), confirmadasSet: new Set() };
      }
      summary[ind.quem_indicou].totalSet.add(ind.lead_id);
      if (ind.fechou_matricula) {
        summary[ind.quem_indicou].confirmadasSet.add(ind.lead_id);
      }
    });
    return Object.entries(summary)
      .map(([name, data]) => [name, { total: data.totalSet.size, confirmadas: data.confirmadasSet.size }] as [string, { total: number; confirmadas: number }])
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
  }, [indicacoes]);

  // Edit handler
  const handleEdit = (indicacao: Indicacao) => {
    setEditingIndicacao(indicacao);
    setEditQuemIndicou(indicacao.quem_indicou);
  };

  const handleSaveEdit = async () => {
    if (!editingIndicacao || !editQuemIndicou.trim()) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('interacoes')
        .update({ quem_indicou: editQuemIndicou.trim().toUpperCase() })
        .eq('id', editingIndicacao.id);
      
      if (error) throw error;
      
      toast({
        title: 'Indicação atualizada',
        description: 'O nome do indicador foi atualizado com sucesso.',
      });
      
      queryClient.invalidateQueries({ queryKey: ['indicacoes-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['indicacoes-total'] });
      setEditingIndicacao(null);
    } catch (error) {
      console.error('Error updating indicação:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar a indicação.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deletingIndicacao) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('interacoes')
        .update({ quem_indicou: null })
        .eq('id', deletingIndicacao.id);
      
      if (error) throw error;
      
      toast({
        title: 'Indicação removida',
        description: 'A indicação foi removida com sucesso.',
      });
      
      queryClient.invalidateQueries({ queryKey: ['indicacoes-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['indicacoes-total'] });
      setDeletingIndicacao(null);
    } catch (error) {
      console.error('Error deleting indicação:', error);
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover a indicação.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Indicações | EVO TRAINING CLUB CRM</title>
        <meta name="description" content="Visualize indicações de alunos por período" />
      </Helmet>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Indicações por Período</h1>
          <p className="text-muted-foreground mt-1">
            Visualize as indicações de alunos filtradas por período
          </p>
        </div>

        {/* Info Alert */}
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
          <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
          <p className="text-sm text-muted-foreground">
            O filtro por período afeta apenas a visualização desta página. 
            Os totais de indicações confirmadas no cadastro do aluno consideram todo o histórico.
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo o Histórico</SelectItem>
                    <SelectItem value="current_month">Mês atual</SelectItem>
                    <SelectItem value="previous_month">Mês anterior</SelectItem>
                    <SelectItem value="custom">Período customizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {periodFilter === 'custom' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Início</label>
                    <Popover open={startOpen} onOpenChange={setStartOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[180px] justify-start text-left font-normal",
                            !customStartDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customStartDate ? format(customStartDate, "dd/MM/yyyy") : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customStartDate}
                          onSelect={(date) => {
                            setCustomStartDate(date);
                            setStartOpen(false);
                          }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Fim</label>
                    <Popover open={endOpen} onOpenChange={setEndOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[180px] justify-start text-left font-normal",
                            !customEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customEndDate ? format(customEndDate, "dd/MM/yyyy") : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customEndDate}
                          onSelect={(date) => {
                            setCustomEndDate(date);
                            setEndOpen(false);
                          }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}

              {dateRange && (
                <div className="text-sm text-muted-foreground">
                  Período: {format(dateRange.start, "dd/MM/yyyy")} - {format(dateRange.end, "dd/MM/yyyy")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total do CRM (Fixo) */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-muted-foreground">Total do CRM (Todo o Histórico)</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalIndicacoesCRM}</div>
                <p className="text-xs text-muted-foreground">todo o histórico</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Indicações Confirmadas</CardTitle>
                <Gift className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{indicacoesConfirmadasCRM}</div>
                <p className="text-xs text-muted-foreground">com matrícula fechada</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-muted-foreground">No Período Selecionado</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total no Período</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalIndicacoesPeriodo}</div>
                <p className="text-xs text-muted-foreground">indicações registradas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Confirmadas no Período</CardTitle>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{indicacoesConfirmadasPeriodo}</div>
                <p className="text-xs text-muted-foreground">com matrícula fechada</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Top Indicadores */}
        {indicadoresSummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Indicadores no Período</CardTitle>
              <CardDescription>Quem mais indicou no período selecionado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {indicadoresSummary.map(([nome, stats]) => (
                  <Badge key={nome} variant="secondary" className="text-sm py-1.5 px-3">
                    {nome}: {stats.total} ({stats.confirmadas} confirmadas)
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista de Indicações</CardTitle>
            <CardDescription>
              Detalhamento das indicações no período selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : indicacoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma indicação encontrada no período selecionado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quem Indicou</TableHead>
                    <TableHead>Aluno Indicado</TableHead>
                    <TableHead>Data da Interação</TableHead>
                    <TableHead>Data da Matrícula</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicacoes.map((indicacao) => (
                    <TableRow key={indicacao.id}>
                      <TableCell className="font-medium">{indicacao.quem_indicou}</TableCell>
                      <TableCell>{indicacao.lead_nome}</TableCell>
                      <TableCell>
                        {format(parseISO(indicacao.data_interacao), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {indicacao.data_fechamento 
                          ? format(parseISO(indicacao.data_fechamento), "dd/MM/yyyy", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant={indicacao.fechou_matricula ? "default" : "secondary"}>
                          {indicacao.fechou_matricula ? 'Confirmada' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(indicacao)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingIndicacao(indicacao)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingIndicacao} onOpenChange={(open) => !open && setEditingIndicacao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Indicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Aluno Indicado</Label>
              <Input value={editingIndicacao?.lead_nome || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quem_indicou">Quem Indicou</Label>
              <Input
                id="quem_indicou"
                value={editQuemIndicou}
                onChange={(e) => setEditQuemIndicou(e.target.value)}
                placeholder="Nome de quem indicou"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingIndicacao(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingIndicacao} onOpenChange={(open) => !open && setDeletingIndicacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Indicação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a indicação de "{deletingIndicacao?.quem_indicou}" para o aluno "{deletingIndicacao?.lead_nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
