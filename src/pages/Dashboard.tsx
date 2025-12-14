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
import { Users, UserPlus, CalendarCheck, Loader2, Calendar, Award, Eye, ChevronDown, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ExperimentaisHoje } from '@/components/dashboard/ExperimentaisHoje';
import { ConfirmacoesAmanha } from '@/components/dashboard/ConfirmacoesAmanha';
import { PendenciasDia } from '@/components/dashboard/PendenciasDia';
import { ExperimentaisSemana } from '@/components/dashboard/ExperimentaisSemana';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { ReagendarModal } from '@/components/dashboard/ReagendarModal';
import { FollowUpCard } from '@/components/dashboard/FollowUpCard';
import { FollowUpKPI } from '@/components/dashboard/FollowUpKPI';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { format, addDays } from 'date-fns';
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
  follow_up: 'Follow Up',
};

const STATUS_COLORS: Record<string, string> = {
  novo: 'bg-blue-100 text-blue-700',
  contato_inicial: 'bg-purple-100 text-purple-700',
  aula_agendada: 'bg-amber-100 text-amber-700',
  aula_realizada: 'bg-orange-100 text-orange-700',
  negociacao: 'bg-cyan-100 text-cyan-700',
  convertido: 'bg-green-100 text-green-700',
  perdido: 'bg-red-100 text-red-700',
  follow_up: 'bg-indigo-100 text-indigo-700',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  
  const [stats, setStats] = useState<Stats>({ total: 0, novos: 0, aulasAgendadas: 0 });
  const [periodStats, setPeriodStats] = useState<PeriodStats>({ experimentaisPeriodo: 0, matriculasPeriodo: 0 });
  const [loading, setLoading] = useState(true);
  
  // Date filter state - inicia com "Todo Histórico" (inclui futuro)
  const [periodType, setPeriodType] = useState<'all' | 'last7days' | 'currentMonth' | 'lastMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState(() => new Date(2020, 0, 1));
  const [endDate, setEndDate] = useState(() => new Date(2030, 11, 31));
  
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
  
  // Follow-up state
  const [followUpItems, setFollowUpItems] = useState<ExperimentalItem[]>([]);
  const [showFollowUpSection, setShowFollowUpSection] = useState(false);
  const followUpSectionRef = useRef<HTMLDivElement>(null);
  
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

    // Calcular o menor e maior range para incluir hoje/amanhã E o período selecionado
    const minDate = startDateStr < today ? startDateStr : today;
    const maxDate = endDateStr > tomorrow ? endDateStr : tomorrow;

    // Fetch all interactions with experimental scheduled in the extended range
    const { data: experimentaisData } = await supabase
      .from('interacoes')
      .select(`
        *,
        leads (
          id,
          nome,
          telefone,
          email,
          origem,
          status_funil,
          plano_escolhido,
          cadastrado_por,
          atendido_por,
          observacoes,
          data_aula_experimental,
          created_by,
          user_id,
          ativo,
          created_at,
          updated_at
        )
      `)
      .eq('agendou_experimental', true)
      .gte('data_experimental', minDate)
      .lte('data_experimental', maxDate)
      .order('data_experimental', { ascending: true })
      .order('hora_experimental', { ascending: true });

    if (!experimentaisData || experimentaisData.length === 0) {
      setExperimentaisHoje([]);
      setConfirmacoesAmanha([]);
      setPendenciasHoje([]);
      setPendenciasAmanha([]);
      setExperimentaisSemana([]);
      setExperimentaisDetalhados([]);
      return;
    }

    // Process interactions
    const todayItems: ExperimentalItem[] = [];
    const tomorrowItems: ExperimentalItem[] = [];
    const pendenciasHojeItems: ExperimentalItem[] = [];
    const pendenciasAmanhaItems: ExperimentalItem[] = [];
    const weekItems: ExperimentalItem[] = [];
    const detailedItems: ExperimentalItem[] = [];

    experimentaisData.forEach((item: any) => {
      if (!item.leads) return;
      // Ignorar leads inativos
      if (item.leads.ativo === false) return;
      
      const lead: Lead = item.leads as Lead;
      const interacao: Interacao = {
        id: item.id,
        lead_id: item.lead_id,
        tipo: item.tipo,
        descricao: item.descricao,
        data_interacao: item.data_interacao,
        created_at: item.created_at,
        created_by: item.created_by,
        atendido_por: item.atendido_por,
        atendido_por_tipo: item.atendido_por_tipo,
        agendou_experimental: item.agendou_experimental,
        data_experimental: item.data_experimental,
        hora_experimental: item.hora_experimental,
        compareceu: item.compareceu,
        confirmado: item.confirmado,
        reagendou: item.reagendou,
        fechou_matricula: item.fechou_matricula,
        plano_escolhido: item.plano_escolhido,
        valor_plano: item.valor_plano,
        comissao_comercial: item.comissao_comercial,
        comissao_recepcao: item.comissao_recepcao,
        comissao_cadastrador: item.comissao_cadastrador,
        cadastrado_por: item.cadastrado_por,
        data_fechamento: item.data_fechamento,
        responsavel_fechamento: item.responsavel_fechamento,
        treinador_responsavel: item.treinador_responsavel,
        treinador_experimental: item.treinador_experimental,
        origem_fechamento: item.origem_fechamento,
        quem_agendou: item.quem_agendou,
        tipo_atendimento: item.tipo_atendimento,
      };

      const experimentalItem: ExperimentalItem = { lead, interacao };
      
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      
      // Add to week view and detailed list only if within selected period
      if (interacao.data_experimental >= startDateStr && interacao.data_experimental <= endDateStr) {
        weekItems.push(experimentalItem);
        detailedItems.push(experimentalItem);
      }

      // Experimentais de hoje - sempre mostra independente do período
      if (interacao.data_experimental === today) {
        if (interacao.compareceu !== true) {
          todayItems.push(experimentalItem);
          pendenciasHojeItems.push(experimentalItem);
        }
      } 
      // Confirmações para amanhã - sempre mostra independente do período
      else if (interacao.data_experimental === tomorrow) {
        if (!interacao.confirmado) {
          tomorrowItems.push(experimentalItem);
          pendenciasAmanhaItems.push(experimentalItem);
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

    // Fetch all matriculas in the period with lead info via JOIN
    const { data: matriculasData } = await supabase
      .from('interacoes')
      .select(`
        id,
        lead_id,
        data_fechamento,
        atendido_por,
        responsavel_fechamento,
        treinador_responsavel,
        plano_escolhido,
        valor_plano,
        comissao_comercial,
        comissao_recepcao,
        comissao_cadastrador,
        leads (
          id,
          nome,
          telefone,
          origem,
          status_funil,
          cadastrado_por,
          created_by,
          ativo
        )
      `)
      .eq('fechou_matricula', true)
      .gte('data_fechamento', startDateStr)
      .lte('data_fechamento', endDateStr)
      .order('data_fechamento', { ascending: false });

    if (!matriculasData || matriculasData.length === 0) {
      setMatriculasDetalhadas([]);
      return;
    }

    const matriculaItems: MatriculaItem[] = [];
    matriculasData.forEach((item: any) => {
      if (!item.leads) return;
      
      const lead: Lead = {
        id: item.leads.id,
        nome: item.leads.nome,
        telefone: item.leads.telefone,
        origem: item.leads.origem,
        status_funil: item.leads.status_funil,
        cadastrado_por: item.leads.cadastrado_por,
        created_by: item.leads.created_by,
        ativo: item.leads.ativo,
        email: null,
        plano_escolhido: null,
        data_aula_experimental: null,
        hora_aula_experimental: null,
        observacoes: null,
        atendido_por: null,
        user_id: null,
        created_at: '',
        updated_at: '',
        follow_up_whatsapp_enviado: false,
        follow_up_enviado_em: null,
        follow_up_responsavel: null,
      };
      
      const interacao: Interacao = {
        id: item.id,
        lead_id: item.lead_id,
        data_fechamento: item.data_fechamento,
        atendido_por: item.atendido_por,
        responsavel_fechamento: item.responsavel_fechamento,
        treinador_responsavel: item.treinador_responsavel,
        plano_escolhido: item.plano_escolhido,
        valor_plano: item.valor_plano,
        comissao_comercial: item.comissao_comercial,
        comissao_recepcao: item.comissao_recepcao,
        comissao_cadastrador: item.comissao_cadastrador,
        tipo: '',
        descricao: null,
        data_interacao: '',
        created_at: '',
        created_by: null,
        atendido_por_tipo: null,
        agendou_experimental: false,
        data_experimental: null,
        hora_experimental: null,
        compareceu: null,
        confirmado: null,
        reagendou: false,
        fechou_matricula: true,
        cadastrado_por: null,
        treinador_experimental: null,
        origem_fechamento: null,
        quem_agendou: null,
        tipo_atendimento: null,
      };
      
      matriculaItems.push({ lead, interacao });
    });

    setMatriculasDetalhadas(matriculaItems);
  }, [startDate, endDate]);

  const fetchFollowUp = useCallback(async () => {
    // Fetch leads in follow_up status with their experimental interactions
    const { data: followUpData } = await supabase
      .from('leads')
      .select(`
        *,
        interacoes (
          id,
          lead_id,
          tipo,
          descricao,
          data_interacao,
          created_at,
          created_by,
          atendido_por,
          atendido_por_tipo,
          agendou_experimental,
          data_experimental,
          hora_experimental,
          compareceu,
          confirmado,
          reagendou,
          fechou_matricula,
          plano_escolhido,
          valor_plano,
          comissao_comercial,
          comissao_recepcao,
          comissao_cadastrador,
          cadastrado_por,
          data_fechamento,
          responsavel_fechamento,
          treinador_responsavel,
          treinador_experimental,
          origem_fechamento,
          quem_agendou,
          tipo_atendimento
        )
      `)
      .eq('status_funil', 'follow_up')
      .eq('ativo', true);

    if (!followUpData || followUpData.length === 0) {
      setFollowUpItems([]);
      return;
    }

    const items: ExperimentalItem[] = [];
    
    followUpData.forEach((leadData: any) => {
      const lead: Lead = {
        id: leadData.id,
        nome: leadData.nome,
        email: leadData.email,
        telefone: leadData.telefone,
        origem: leadData.origem,
        status_funil: leadData.status_funil,
        plano_escolhido: leadData.plano_escolhido,
        data_aula_experimental: leadData.data_aula_experimental,
        hora_aula_experimental: leadData.hora_aula_experimental,
        observacoes: leadData.observacoes,
        atendido_por: leadData.atendido_por,
        cadastrado_por: leadData.cadastrado_por,
        ativo: leadData.ativo,
        user_id: leadData.user_id,
        created_by: leadData.created_by,
        created_at: leadData.created_at,
        updated_at: leadData.updated_at,
        follow_up_whatsapp_enviado: leadData.follow_up_whatsapp_enviado || false,
        follow_up_enviado_em: leadData.follow_up_enviado_em,
        follow_up_responsavel: leadData.follow_up_responsavel,
      };

      // Find the most recent experimental interaction
      const experimentalInteracao = leadData.interacoes?.find(
        (i: any) => i.agendou_experimental && i.compareceu === true
      ) || leadData.interacoes?.[0];

      if (experimentalInteracao) {
        const interacao: Interacao = {
          id: experimentalInteracao.id,
          lead_id: experimentalInteracao.lead_id,
          tipo: experimentalInteracao.tipo,
          descricao: experimentalInteracao.descricao,
          data_interacao: experimentalInteracao.data_interacao,
          created_at: experimentalInteracao.created_at,
          created_by: experimentalInteracao.created_by,
          atendido_por: experimentalInteracao.atendido_por,
          atendido_por_tipo: experimentalInteracao.atendido_por_tipo,
          agendou_experimental: experimentalInteracao.agendou_experimental,
          data_experimental: experimentalInteracao.data_experimental,
          hora_experimental: experimentalInteracao.hora_experimental,
          compareceu: experimentalInteracao.compareceu,
          confirmado: experimentalInteracao.confirmado,
          reagendou: experimentalInteracao.reagendou,
          fechou_matricula: experimentalInteracao.fechou_matricula,
          plano_escolhido: experimentalInteracao.plano_escolhido,
          valor_plano: experimentalInteracao.valor_plano,
          comissao_comercial: experimentalInteracao.comissao_comercial,
          comissao_recepcao: experimentalInteracao.comissao_recepcao,
          comissao_cadastrador: experimentalInteracao.comissao_cadastrador,
          cadastrado_por: experimentalInteracao.cadastrado_por,
          data_fechamento: experimentalInteracao.data_fechamento,
          responsavel_fechamento: experimentalInteracao.responsavel_fechamento,
          treinador_responsavel: experimentalInteracao.treinador_responsavel,
          treinador_experimental: experimentalInteracao.treinador_experimental,
          origem_fechamento: experimentalInteracao.origem_fechamento,
          quem_agendou: experimentalInteracao.quem_agendou,
          tipo_atendimento: experimentalInteracao.tipo_atendimento,
        };
        
        items.push({ lead, interacao });
      }
    });

    setFollowUpItems(items);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchExperimentais(), fetchPeriodStats(), fetchMatriculas(), fetchFollowUp()]);
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
    setShowFollowUpSection(false);
    setTimeout(() => {
      experimentaisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleMatriculasCardClick = () => {
    setShowMatriculasSection(true);
    setShowExperimentaisSection(false);
    setShowFollowUpSection(false);
    setTimeout(() => {
      matriculasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleFollowUpCardClick = () => {
    setShowFollowUpSection(true);
    setShowExperimentaisSection(false);
    setShowMatriculasSection(false);
    setTimeout(() => {
      followUpSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const canEditLead = (lead: Lead): boolean => {
    if (isAdmin) return true;
    return lead.created_by === user?.id;
  };

  const handleDeleteExperimental = async (interacaoId: string) => {
    try {
      const { error } = await supabase
        .from('interacoes')
        .update({ agendou_experimental: false, data_experimental: null, hora_experimental: null })
        .eq('id', interacaoId);

      if (error) throw error;
      
      toast.success('Experimental removida com sucesso!');
      fetchData();
    } catch (error) {
      console.error('Erro ao remover experimental:', error);
      toast.error('Erro ao remover experimental');
    }
  };

  const handleDeleteMatricula = async (interacaoId: string) => {
    try {
      const { error } = await supabase
        .from('interacoes')
        .update({ fechou_matricula: false, data_fechamento: null, valor_plano: null, plano_escolhido: null })
        .eq('id', interacaoId);

      if (error) throw error;
      
      toast.success('Matrícula removida com sucesso!');
      fetchData();
    } catch (error) {
      console.error('Erro ao remover matrícula:', error);
      toast.error('Erro ao remover matrícula');
    }
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
            periodType={periodType}
            onPeriodTypeChange={setPeriodType}
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
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

          {/* Follow Up KPI */}
          <FollowUpKPI
            pendingCount={followUpItems.filter(i => !i.lead.follow_up_whatsapp_enviado).length}
            onClick={handleFollowUpCardClick}
            isActive={showFollowUpSection}
          />

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

        {/* Follow Up Section */}
        {showFollowUpSection && (
          <div ref={followUpSectionRef} className="mb-8">
            <FollowUpCard items={followUpItems} onRefresh={fetchData} />
          </div>
        )}

        {/* Experimental Control Panels with Tabs */}
        <Tabs defaultValue="diario" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <TabsList>
              <TabsTrigger value="diario">Controle Diário</TabsTrigger>
              <TabsTrigger value="semana">Visão do Período</TabsTrigger>
            </TabsList>
          </div>

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

          <TabsContent value="semana" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={periodType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setPeriodType('all');
                  setStartDate(new Date(2020, 0, 1));
                  setEndDate(new Date(2030, 11, 31));
                }}
              >
                Todo Período
              </Button>
              <Button
                variant={periodType === 'last7days' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setPeriodType('last7days');
                  const today = new Date();
                  setStartDate(addDays(today, -7));
                  setEndDate(today);
                }}
              >
                Últimos 7 dias
              </Button>
              <Button
                variant={periodType === 'currentMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setPeriodType('currentMonth');
                  const today = new Date();
                  setStartDate(new Date(today.getFullYear(), today.getMonth(), 1));
                  setEndDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
                }}
              >
                Mês Atual
              </Button>
              <Button
                variant={periodType === 'lastMonth' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setPeriodType('lastMonth');
                  const today = new Date();
                  setStartDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
                  setEndDate(new Date(today.getFullYear(), today.getMonth(), 0));
                }}
              >
                Mês Anterior
              </Button>
            </div>
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
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/lead/${item.lead.id}`)}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  {canEditLead(item.lead) ? 'Ver / Editar' : 'Ver'}
                                </Button>
                                {isAdmin && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="destructive">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remover Experimental</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Tem certeza que deseja remover esta aula experimental de {item.lead.nome}? Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteExperimental(item.interacao.id)}>
                                          Remover
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
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
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/lead/${item.lead.id}`)}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  {canEditLead(item.lead) ? 'Ver / Editar' : 'Ver'}
                                </Button>
                                {isAdmin && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="destructive">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remover Matrícula</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Tem certeza que deseja remover a matrícula de {item.lead.nome}? Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteMatricula(item.interacao.id)}>
                                          Remover
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
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
