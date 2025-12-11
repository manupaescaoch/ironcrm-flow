import { useEffect, useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Lead, Interacao, StatusFunil } from '@/types/database';
import { Users, UserPlus, CalendarCheck, TrendingUp, Loader2 } from 'lucide-react';
import { ExperimentaisHoje } from '@/components/dashboard/ExperimentaisHoje';
import { ConfirmacoesAmanha } from '@/components/dashboard/ConfirmacoesAmanha';
import { PendenciasDia } from '@/components/dashboard/PendenciasDia';
import { ReagendarModal } from '@/components/dashboard/ReagendarModal';
import { format, addDays } from 'date-fns';

interface Stats {
  total: number;
  novos: number;
  aulasAgendadas: number;
  convertidos: number;
}

interface ExperimentalItem {
  lead: Lead;
  interacao: Interacao;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, novos: 0, aulasAgendadas: 0, convertidos: 0 });
  const [loading, setLoading] = useState(true);
  
  // Experimental control state
  const [experimentaisHoje, setExperimentaisHoje] = useState<ExperimentalItem[]>([]);
  const [confirmacoesAmanha, setConfirmacoesAmanha] = useState<ExperimentalItem[]>([]);
  const [pendenciasHoje, setPendenciasHoje] = useState<ExperimentalItem[]>([]);
  const [pendenciasAmanha, setPendenciasAmanha] = useState<ExperimentalItem[]>([]);
  
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
        convertidos: typedLeads.filter(l => l.status_funil === 'convertido').length,
      });
    }
  };

  const fetchExperimentais = useCallback(async () => {
    // Fetch all interactions with experimental scheduled for today or tomorrow
    const { data: interacoes } = await supabase
      .from('interacoes')
      .select('*')
      .eq('agendou_experimental', true)
      .in('data_experimental', [today, tomorrow])
      .order('hora_experimental', { ascending: true });

    if (!interacoes) return;

    // Get unique lead IDs
    const leadIds = [...new Set(interacoes.map(i => i.lead_id))];
    
    if (leadIds.length === 0) {
      setExperimentaisHoje([]);
      setConfirmacoesAmanha([]);
      setPendenciasHoje([]);
      setPendenciasAmanha([]);
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

    (interacoes as unknown as Interacao[]).forEach(interacao => {
      const lead = leadsMap.get(interacao.lead_id);
      if (!lead) return;

      const item: ExperimentalItem = { lead, interacao };

      if (interacao.data_experimental === today) {
        // Today's experimentals
        if (interacao.compareceu === true) {
          // Already marked as present, skip
        } else if (interacao.compareceu === null) {
          // Not marked yet - show in main list and pendências
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
  }, [today, tomorrow]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchExperimentais()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                Convertidos
              </CardTitle>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.convertidos}</p>
            </CardContent>
          </Card>
        </div>

        {/* Experimental Control Panels */}
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
