import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Lead, Interacao } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Target, 
  Clock, 
  Percent,
  Filter,
  BarChart3,
  UserCheck,
  Briefcase
} from 'lucide-react';
import { format, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InteracaoComLead extends Interacao {
  lead?: Lead;
}

export default function DashboardExecutivo() {
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [interacoes, setInteracoes] = useState<InteracaoComLead[]>([]);
  const { toast } = useToast();

  // Filters
  const [dataInicio, setDataInicio] = useState<string>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [dataFim, setDataFim] = useState<string>(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [filterOrigem, setFilterOrigem] = useState<string>('');
  const [filterAtendente, setFilterAtendente] = useState<string>('');

  // Unique values for filters
  const [origensDisponiveis, setOrigensDisponiveis] = useState<string[]>([]);
  const [atendentesDisponiveis, setAtendentesDisponiveis] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [dataInicio, dataFim]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch leads in date range
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim + 'T23:59:59')
      .eq('ativo', true);

    if (leadsError) {
      toast({ title: 'Erro ao carregar leads', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Fetch interacoes with fechou_matricula = true in date range
    const { data: interacoesData, error: interacoesError } = await supabase
      .from('interacoes')
      .select('*, leads(*)')
      .eq('fechou_matricula', true)
      .gte('data_fechamento', dataInicio)
      .lte('data_fechamento', dataFim);

    if (interacoesError) {
      toast({ title: 'Erro ao carregar matrículas', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const typedLeads = (leadsData || []) as unknown as Lead[];
    const typedInteracoes = (interacoesData || []).map((int: any) => ({
      ...int,
      lead: int.leads as Lead,
    })) as InteracaoComLead[];

    setLeads(typedLeads);
    setInteracoes(typedInteracoes);

    // Extract unique values for filters
    const origens = [...new Set(typedLeads.map(l => l.origem).filter(Boolean))] as string[];
    const atendentes = [...new Set([
      ...typedLeads.map(l => l.atendido_por).filter(Boolean),
      ...typedInteracoes.map(i => i.responsavel_fechamento).filter(Boolean),
    ])] as string[];

    setOrigensDisponiveis(origens);
    setAtendentesDisponiveis(atendentes);
    setLoading(false);
  };

  // Apply filters
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (filterOrigem && lead.origem !== filterOrigem) return false;
      if (filterAtendente && lead.atendido_por !== filterAtendente) return false;
      return true;
    });
  }, [leads, filterOrigem, filterAtendente]);

  const filteredInteracoes = useMemo(() => {
    return interacoes.filter(int => {
      if (filterOrigem && int.lead?.origem !== filterOrigem) return false;
      if (filterAtendente) {
        const match = int.responsavel_fechamento === filterAtendente || 
                     int.lead?.atendido_por === filterAtendente;
        if (!match) return false;
      }
      return true;
    });
  }, [interacoes, filterOrigem, filterAtendente]);

  // KPIs
  const kpis = useMemo(() => {
    const leadsNoPeriodo = filteredLeads.length;
    const matriculasNoPeriodo = filteredInteracoes.length;
    const taxaConversao = leadsNoPeriodo > 0 ? (matriculasNoPeriodo / leadsNoPeriodo) * 100 : 0;
    const faturamento = filteredInteracoes.reduce((sum, int) => sum + (int.valor_plano || 0), 0);
    const ticketMedio = matriculasNoPeriodo > 0 ? faturamento / matriculasNoPeriodo : 0;
    const comissaoTotal = filteredInteracoes.reduce(
      (sum, int) => sum + (int.comissao_comercial || 0) + (int.comissao_recepcao || 0),
      0
    );

    // Calculate average days to close
    let totalDias = 0;
    let countDias = 0;
    filteredInteracoes.forEach(int => {
      if (int.data_fechamento && int.lead?.created_at) {
        const dias = differenceInDays(
          new Date(int.data_fechamento),
          new Date(int.lead.created_at)
        );
        if (dias >= 0) {
          totalDias += dias;
          countDias++;
        }
      }
    });
    const prazoMedio = countDias > 0 ? Math.round(totalDias / countDias) : 0;

    return {
      leadsNoPeriodo,
      matriculasNoPeriodo,
      taxaConversao,
      faturamento,
      ticketMedio,
      comissaoTotal,
      prazoMedio,
    };
  }, [filteredLeads, filteredInteracoes]);

  // Performance by Origem
  const desempenhoPorOrigem = useMemo(() => {
    const grouped = new Map<string, { leads: number; matriculas: number; faturamento: number }>();

    filteredLeads.forEach(lead => {
      const origem = lead.origem || 'Não informado';
      const current = grouped.get(origem) || { leads: 0, matriculas: 0, faturamento: 0 };
      grouped.set(origem, { ...current, leads: current.leads + 1 });
    });

    filteredInteracoes.forEach(int => {
      const origem = int.lead?.origem || 'Não informado';
      const current = grouped.get(origem) || { leads: 0, matriculas: 0, faturamento: 0 };
      grouped.set(origem, {
        ...current,
        matriculas: current.matriculas + 1,
        faturamento: current.faturamento + (int.valor_plano || 0),
      });
    });

    return Array.from(grouped.entries()).map(([origem, data]) => ({
      origem,
      leads: data.leads,
      matriculas: data.matriculas,
      taxaConversao: data.leads > 0 ? (data.matriculas / data.leads) * 100 : 0,
      faturamento: data.faturamento,
      ticketMedio: data.matriculas > 0 ? data.faturamento / data.matriculas : 0,
    })).sort((a, b) => b.faturamento - a.faturamento);
  }, [filteredLeads, filteredInteracoes]);

  // Performance by Atendente/Comercial
  const desempenhoPorAtendente = useMemo(() => {
    const grouped = new Map<string, { matriculas: number; faturamento: number; comissaoComercial: number }>();

    filteredInteracoes.forEach(int => {
      const responsavel = int.responsavel_fechamento || 'Não informado';
      const current = grouped.get(responsavel) || { matriculas: 0, faturamento: 0, comissaoComercial: 0 };
      grouped.set(responsavel, {
        matriculas: current.matriculas + 1,
        faturamento: current.faturamento + (int.valor_plano || 0),
        comissaoComercial: current.comissaoComercial + (int.comissao_comercial || 0),
      });
    });

    return Array.from(grouped.entries()).map(([responsavel, data]) => ({
      responsavel,
      ...data,
    })).sort((a, b) => b.matriculas - a.matriculas);
  }, [filteredInteracoes]);

  // Performance by Treinador
  const desempenhoPorTreinador = useMemo(() => {
    const grouped = new Map<string, { matriculas: number; faturamento: number }>();

    filteredInteracoes.forEach(int => {
      const treinador = int.treinador_responsavel || 'Não informado';
      const current = grouped.get(treinador) || { matriculas: 0, faturamento: 0 };
      grouped.set(treinador, {
        matriculas: current.matriculas + 1,
        faturamento: current.faturamento + (int.valor_plano || 0),
      });
    });

    return Array.from(grouped.entries()).map(([treinador, data]) => ({
      treinador,
      ...data,
    })).sort((a, b) => b.matriculas - a.matriculas);
  }, [filteredInteracoes]);

  // Funnel Summary
  const resumoFunil = useMemo(() => {
    const statusCounts = new Map<string, number>();
    const statusLabels: Record<string, string> = {
      novo: 'Novo',
      contato_inicial: 'Contato Inicial',
      aula_agendada: 'Aula Agendada',
      aula_realizada: 'Aula Realizada',
      negociacao: 'Negociação',
      convertido: 'Convertido',
      perdido: 'Perdido',
    };

    filteredLeads.forEach(lead => {
      const status = lead.status_funil;
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });

    return Object.entries(statusLabels).map(([key, label]) => ({
      status: key,
      label,
      quantidade: statusCounts.get(key) || 0,
    }));
  }, [filteredLeads]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const clearFilters = () => {
    setFilterOrigem('');
    setFilterAtendente('');
  };

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard Executivo</h1>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Origem (opcional)</Label>
                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as origens" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {origensDisponiveis.map((origem) => (
                      <SelectItem key={origem} value={origem}>
                        {origem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Atendente (opcional)</Label>
                <Select value={filterAtendente} onValueChange={setFilterAtendente}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os atendentes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {atendentesDisponiveis.map((atendente) => (
                      <SelectItem key={atendente} value={atendente}>
                        {atendente}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Limpar Filtros
                </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Leads</p>
                      <p className="text-xl font-bold">{kpis.leadsNoPeriodo}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Matrículas</p>
                      <p className="text-xl font-bold">{kpis.matriculasNoPeriodo}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                      <Percent className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Conversão</p>
                      <p className="text-xl font-bold">{kpis.taxaConversao.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Faturamento</p>
                      <p className="text-lg font-bold">{formatCurrency(kpis.faturamento)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ticket Médio</p>
                      <p className="text-lg font-bold">{formatCurrency(kpis.ticketMedio)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-500/10 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-pink-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Comissões</p>
                      <p className="text-lg font-bold">{formatCurrency(kpis.comissaoTotal)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-cyan-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Prazo Médio</p>
                      <p className="text-xl font-bold">{kpis.prazoMedio} dias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance by Origem */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Desempenho por Origem
                </CardTitle>
              </CardHeader>
              <CardContent>
                {desempenhoPorOrigem.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhum dado encontrado</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Origem</TableHead>
                          <TableHead className="text-center">Leads</TableHead>
                          <TableHead className="text-center">Matrículas</TableHead>
                          <TableHead className="text-center">Conversão</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {desempenhoPorOrigem.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.origem}</TableCell>
                            <TableCell className="text-center">{item.leads}</TableCell>
                            <TableCell className="text-center">{item.matriculas}</TableCell>
                            <TableCell className="text-center">{item.taxaConversao.toFixed(1)}%</TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(item.faturamento)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.ticketMedio)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance by Atendente and Treinador */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-green-500" />
                    Desempenho por Comercial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {desempenhoPorAtendente.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhum dado encontrado</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-center">Matrículas</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Comissão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {desempenhoPorAtendente.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.responsavel}</TableCell>
                            <TableCell className="text-center">{item.matriculas}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.faturamento)}</TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(item.comissaoComercial)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-500" />
                    Fechamentos por Treinador
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {desempenhoPorTreinador.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhum dado encontrado</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Treinador</TableHead>
                          <TableHead className="text-center">Matrículas</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {desempenhoPorTreinador.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.treinador}</TableCell>
                            <TableCell className="text-center">{item.matriculas}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(item.faturamento)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Funnel Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Resumo do Funil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  {resumoFunil.map((item) => (
                    <div
                      key={item.status}
                      className={`p-4 rounded-lg text-center ${
                        item.status === 'convertido'
                          ? 'bg-green-500/10 border border-green-500/20'
                          : item.status === 'perdido'
                          ? 'bg-red-500/10 border border-red-500/20'
                          : 'bg-muted/50'
                      }`}
                    >
                      <p className="text-2xl font-bold">{item.quantidade}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
