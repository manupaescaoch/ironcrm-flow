import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Lead, Interacao } from '@/types/database';
import { Users, UserPlus, CalendarCheck, Loader2, Calendar, Award, Eye, ChevronDown } from 'lucide-react';
import { ExperimentaisHoje } from '@/components/dashboard/ExperimentaisHoje';
import { ConfirmacoesAmanha } from '@/components/dashboard/ConfirmacoesAmanha';
import { PendenciasDia } from '@/components/dashboard/PendenciasDia';
import { ExperimentaisSemana } from '@/components/dashboard/ExperimentaisSemana';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { ReagendarModal } from '@/components/dashboard/ReagendarModal';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Stats {
  total: number;
  novos: number;
  aulasAgendadas: number;
}

interface PeriodStats {
  experimentaisPeriodo: number;
  matriculasPeriodo: number;
}

interface ExperimentalItem {
  lead: Lead;
  interacao: Interacao;
}

interface MatriculaItem {
  lead: Lead;
  interacao: Interacao;
}

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  contato_inicial: 'Contato Inicial',
  aula_agendada: 'Aula Agendada',
  aula_realizada: 'Aula Realizada',
  negociacao: 'Negociação',
  convertido: 'Convertido',
  perdido: 'Perdido',
};

const STATUS_COLORS: Record<string, string> = {
  novo: 'bg-blue-100 text-blue-700',
  contato_inicial: 'bg-purple-100 text-purple-700',
  aula_agendada: 'bg-amber-100 text-amber-700',
  aula_realizada: 'bg-orange-100 text-orange-700',
  negociacao: 'bg-cyan-100 text-cyan-700',
  convertido: 'bg-green-100 text-green-700',
  perdido: 'bg-red-100 text-red-700',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  
  const [stats, setStats] = useState<Stats>({ total: 0, novos: 0, aulasAgendadas: 0 });
  const [periodStats, setPeriodStats] = useState<PeriodStats>({ experimentaisPeriodo: 0, matriculasPeriodo: 0 });
  const [loading, setLoading] = useState(true);
  
  // Date filter state
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState(() => endOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // Experimental control state
  const [experimentaisHoje, setExperimentaisHoje] = useState<ExperimentalItem[]>([]);
  const [confirmacoesAmanha, setConfirmacoesAmanha] = useState<ExperimentalItem[]>([]);
  const [pendenciasHoje, setPendenciasHoje] = useState<ExperimentalItem[]>([]);
  const [pendenciasAmanha, setPendenciasAmanha] = useState<ExperimentalItem[]>([]);
  const [experimentaisSemana, setExperimentaisSemana] = useState<ExperimentalItem[]>([]);
  
  // Detailed lists state
  const [experimentaisDetalhados, setExperimentaisDetalhados] = useState<ExperimentalItem[]>([]);
  const [matriculasDetalhadas, setMatriculasDetalhadas] = useState<MatriculaItem[]>([]);
  const [showExperimentaisSection, setShowExperimentaisSection] = useState(false);
  const [showMatriculasSection, setShowMatriculasSection] = useState(false);
  
  // Refs for scrolling
  const experimentaisSectionRef = useRef<HTMLDivElement>(null);
  const matriculasSectionRef = useRef<HTMLDivElement>(null);
  
  // Modal state
  const [reagendarModalOpen, setReagendarModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExperimentalItem | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const fetchStats = async () => {
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('ativo', true);

    if (leads) {
      const typedLeads = leads as unknown as Lead[];
      setStats({
        total: typedLeads.length,
        novos: typedLeads.filter(l => l.status_funil === 'novo').length,
        aulasAgendadas: typedLeads.filter(l => l.status_funil === 'aula_agendada').length,
      });
    }
  };

  const fetchPeriodStats = useCallback(async () => {
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Fetch experimental count for period
    const { count: experimentaisCount } = await supabase
      .from('interacoes')
      .select('*', { count: 'exact', head: true })
      .eq('agendou_experimental', true)
      .gte('data_experimental', startDateStr)
      .lte('data_experimental', endDateStr);

    // Fetch matriculas count for period
    const { count: matriculasCount } = await supabase
      .from('interacoes')
      .select('*', { count: 'exact', head: true })
      .eq('fechou_matricula', true)
      .gte('data_fechamento', startDateStr)
      .lte('data_fechamento', endDateStr);

    setPeriodStats({
      experimentaisPeriodo: experimentaisCount || 0,
      matriculasPeriodo: matriculasCount || 0,
    });
  }, [startDate, endDate]);

  const fetchExperimentais = useCallback(async () => {
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Fetch all interactions with experimental scheduled in the range
    const { data: interacoes } = await supabase
      .from('interacoes')
      .select('*')
      .eq('agendou_experimental', true)
      .gte('data_experimental', startDateStr)
      .lte('data_experimental', endDateStr)
      .order('data_experimental', { ascending: true })
      .order('hora_experimental', { ascending: true });

    if (!interacoes) return;

    // Get unique lead IDs
    const leadIds = [...new Set(interacoes.map(i => i.lead_id))];
    
    if (leadIds.length === 0) {
      setExperimentaisHoje([]);
      setConfirmacoesAmanha([]);
      setPendenciasHoje([]);
      setPendenciasAmanha([]);
      setExperimentaisSemana([]);
      setExperimentaisDetalhados([]);
      return;
    }

    // Fetch corresponding leads
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .in('id', leadIds)
      .eq('ativo', true);

    if (!leads) return;

    const leadsMap = new Map(leads.map(l => [l.id, l as unknown as Lead]));

    // Process interactions
    const todayItems: ExperimentalItem[] = [];
    const tomorrowItems: ExperimentalItem[] = [];
    const pendenciasHojeItems: ExperimentalItem[] = [];
    const pendenciasAmanhaItems: ExperimentalItem[] = [];
    const weekItems: ExperimentalItem[] = [];
    const detailedItems: ExperimentalItem[] = [];

    (interacoes as unknown as Interacao[]).forEach(interacao => {
      const lead = leadsMap.get(interacao.lead_id);
      if (!lead) return;

      const item: ExperimentalItem = { lead, interacao };
      
      // Add to week view and detailed list
      weekItems.push(item);
      detailedItems.push(item);

      if (interacao.data_experimental === today) {
        if (interacao.compareceu !== true) {
          todayItems.push(item);
          pendenciasHojeItems.push(item);
        }
      } else if (interacao.data_experimental === tomorrow) {
        if (!interacao.confirmado) {
          tomorrowItems.push(item);
          pendenciasAmanhaItems.push(item);
        }
      }
    });

    setExperimentaisHoje(todayItems);
    setConfirmacoesAmanha(tomorrowItems);
    setPendenciasHoje(pendenciasHojeItems);
    setPendenciasAmanha(pendenciasAmanhaItems);
    setExperimentaisSemana(weekItems);
    setExperimentaisDetalhados(detailedItems);
  }, [today, tomorrow, startDate, endDate]);

  const fetchMatriculas = useCallback(async () => {
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Fetch all matriculas in the period
    const { data: interacoes } = await supabase
      .from('interacoes')
      .select('*')
      .eq('fechou_matricula', true)
      .gte('data_fechamento', startDateStr)
      .lte('data_fechamento', endDateStr)
      .order('data_fechamento', { ascending: false });

    if (!interacoes || interacoes.length === 0) {
      setMatriculasDetalhadas([]);
      return;
    }

    // Get unique lead IDs
    const leadIds = [...new Set(interacoes.map(i => i.lead_id))];

    // Fetch corresponding leads
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .in('id', leadIds)
      .eq('ativo', true);

    if (!leads) {
      setMatriculasDetalhadas([]);
      return;
    }

    const leadsMap = new Map(leads.map(l => [l.id, l as unknown as Lead]));

    const matriculaItems: MatriculaItem[] = [];
    (interacoes as unknown as Interacao[]).forEach(interacao => {
      const lead = leadsMap.get(interacao.lead_id);
      if (!lead) return;
      matriculaItems.push({ lead, interacao });
    });

    setMatriculasDetalhadas(matriculaItems);
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchExperimentais(), fetchPeriodStats(), fetchMatriculas()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const handleReagendar = (item: ExperimentalItem) => {
    setSelectedItem(item);
    setReagendarModalOpen(true);
  };

  const handleReagendarSuccess = () => {
    fetchExperimentais();
  };

  const handleExperimentaisCardClick = () => {
    setShowExperimentaisSection(true);
    setShowMatriculasSection(false);
    setTimeout(() => {
      experimentaisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleMatriculasCardClick = () => {
    setShowMatriculasSection(true);
    setShowExperimentaisSection(false);
    setTimeout(() => {
      matriculasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const canEditLead = (lead: Lead): boolean => {
    if (isAdmin) return true;
    return lead.created_by === user?.id;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: number | null): string => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Leads
              </CardTitle>
              <Users className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Leads Novos
              </CardTitle>
              <UserPlus className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{stats.novos}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aulas Agendadas
              </CardTitle>
              <CalendarCheck className="w-5 h-5 text-sky-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-sky-600">{stats.aulasAgendadas}</p>
            </CardContent>
          </Card>

          {/* Clickable Experimentais Card */}
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md hover:border-purple-300",
              showExperimentaisSection && "ring-2 ring-purple-500 border-purple-500"
            )}
            onClick={handleExperimentaisCardClick}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Experimentais da Semana
              </CardTitle>
              <Calendar className="w-5 h-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{periodStats.experimentaisPeriodo}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                Clique para ver detalhes <ChevronDown className="w-3 h-3" />
              </p>
            </CardContent>
          </Card>

          {/* Clickable Matrículas Card */}
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md hover:border-amber-300",
              showMatriculasSection && "ring-2 ring-amber-500 border-amber-500"
            )}
            onClick={handleMatriculasCardClick}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Matrículas no Período
              </CardTitle>
              <Award className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600">{periodStats.matriculasPeriodo}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                Clique para ver detalhes <ChevronDown className="w-3 h-3" />
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Experimental Control Panels with Tabs */}
        <Tabs defaultValue="diario" className="space-y-6">
          <TabsList>
            <TabsTrigger value="diario">Controle Diário</TabsTrigger>
            <TabsTrigger value="semana">Visão do Período</TabsTrigger>
          </TabsList>

          <TabsContent value="diario" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ExperimentaisHoje
                items={experimentaisHoje}
                onRefresh={fetchExperimentais}
                onReagendar={handleReagendar}
              />
              
              <ConfirmacoesAmanha
                items={confirmacoesAmanha}
                onRefresh={fetchExperimentais}
                onReagendar={handleReagendar}
              />
              
              <PendenciasDia
                pendenciasHoje={pendenciasHoje}
                pendenciasAmanha={pendenciasAmanha}
                onReagendar={handleReagendar}
              />
            </div>
          </TabsContent>

          <TabsContent value="semana">
            <ExperimentaisSemana
              items={experimentaisSemana}
              onReagendar={handleReagendar}
              onRefresh={fetchExperimentais}
              startDate={startDate}
              endDate={endDate}
            />
          </TabsContent>
        </Tabs>

        {/* Detailed Experimentais Section */}
        {showExperimentaisSection && (
          <div ref={experimentaisSectionRef} className="mt-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    Experimentais no Período
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowExperimentaisSection(false)}>
                  Fechar
                </Button>
              </CardHeader>
              <CardContent>
                {experimentaisDetalhados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma aula experimental agendada nesse período.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Hora</TableHead>
                          <TableHead>Atendido Por</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {experimentaisDetalhados.map((item) => (
                          <TableRow key={item.interacao.id}>
                            <TableCell className="font-medium">{item.lead.nome}</TableCell>
                            <TableCell>
                              <WhatsAppLink phone={item.lead.telefone} />
                            </TableCell>
                            <TableCell>{formatDate(item.interacao.data_experimental)}</TableCell>
                            <TableCell>{item.interacao.hora_experimental || '-'}</TableCell>
                            <TableCell>{item.interacao.atendido_por || '-'}</TableCell>
                            <TableCell>
                              <Badge className={cn("text-xs", STATUS_COLORS[item.lead.status_funil] || 'bg-gray-100 text-gray-700')}>
                                {STATUS_LABELS[item.lead.status_funil] || item.lead.status_funil}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/lead/${item.lead.id}`)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                {canEditLead(item.lead) ? 'Ver / Editar' : 'Ver'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Matrículas Section */}
        {showMatriculasSection && (
          <div ref={matriculasSectionRef} className="mt-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    Matrículas no Período
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowMatriculasSection(false)}>
                  Fechar
                </Button>
              </CardHeader>
              <CardContent>
                {matriculasDetalhadas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma matrícula registrada nesse período.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Lead</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Cadastrado Por</TableHead>
                          <TableHead>Resp. Fechamento</TableHead>
                          <TableHead>Treinador</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matriculasDetalhadas.map((item) => (
                          <TableRow key={item.interacao.id}>
                            <TableCell>{formatDate(item.interacao.data_fechamento)}</TableCell>
                            <TableCell className="font-medium">{item.lead.nome}</TableCell>
                            <TableCell>
                              <WhatsAppLink phone={item.lead.telefone} />
                            </TableCell>
                            <TableCell>{item.lead.origem || '-'}</TableCell>
                            <TableCell>{item.lead.cadastrado_por || '-'}</TableCell>
                            <TableCell>{item.interacao.responsavel_fechamento || '-'}</TableCell>
                            <TableCell>{item.interacao.treinador_responsavel || '-'}</TableCell>
                            <TableCell>
                              {item.interacao.plano_escolhido ? (
                                <Badge variant="outline">{item.interacao.plano_escolhido}</Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {formatCurrency(item.interacao.valor_plano)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/lead/${item.lead.id}`)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                {canEditLead(item.lead) ? 'Ver / Editar' : 'Ver'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <ReagendarModal
        open={reagendarModalOpen}
        onOpenChange={setReagendarModalOpen}
        item={selectedItem}
        onSuccess={handleReagendarSuccess}
      />
    </Layout>
  );
}
