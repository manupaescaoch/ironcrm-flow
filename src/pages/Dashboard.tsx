import { useEffect, useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Lead, Interacao } from '@/types/database';
import { Users, UserPlus, CalendarCheck, Loader2, Calendar, Award } from 'lucide-react';
import { ExperimentaisHoje } from '@/components/dashboard/ExperimentaisHoje';
import { ConfirmacoesAmanha } from '@/components/dashboard/ConfirmacoesAmanha';
import { PendenciasDia } from '@/components/dashboard/PendenciasDia';
import { ExperimentaisSemana } from '@/components/dashboard/ExperimentaisSemana';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { ReagendarModal } from '@/components/dashboard/ReagendarModal';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';

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

export default function Dashboard() {
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

    (interacoes as unknown as Interacao[]).forEach(interacao => {
      const lead = leadsMap.get(interacao.lead_id);
      if (!lead) return;

      const item: ExperimentalItem = { lead, interacao };
      
      // Add to week view
      weekItems.push(item);

      if (interacao.data_experimental === today) {
        // Today's experimentals
        if (interacao.compareceu === true) {
          // Already marked as present, skip from active lists
        } else {
          // Not marked yet (compareceu is null or false) - show in main list and pendências
          todayItems.push(item);
          pendenciasHojeItems.push(item);
        }
      } else if (interacao.data_experimental === tomorrow) {
        // Tomorrow's experimentals
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
  }, [today, tomorrow, startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchExperimentais(), fetchPeriodStats()]);
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Experimentais da Semana
              </CardTitle>
              <Calendar className="w-5 h-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{periodStats.experimentaisPeriodo}</p>
              <p className="text-xs text-muted-foreground mt-1">Aulas agendadas no período</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Matrículas no Período
              </CardTitle>
              <Award className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600">{periodStats.matriculasPeriodo}</p>
              <p className="text-xs text-muted-foreground mt-1">Matrículas fechadas no período</p>
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
