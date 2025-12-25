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
import { useUnidade } from '@/contexts/UnidadeContext';
import { Lead, Interacao } from '@/types/database';
import { Users, UserPlus, CalendarCheck, Loader2, Calendar, Award, Eye, ChevronDown, Trash2, MessageCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { EventosHoje, EventoItem } from '@/components/dashboard/EventosHoje';
import { ConfirmacoesAmanha } from '@/components/dashboard/ConfirmacoesAmanha';
import { PendenciasDia } from '@/components/dashboard/PendenciasDia';
import { ExperimentaisSemana } from '@/components/dashboard/ExperimentaisSemana';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { ReagendarModal } from '@/components/dashboard/ReagendarModal';
import { FollowUpCard } from '@/components/dashboard/FollowUpCard';
import { AutoFollowUpCard, FollowUpAutoItem } from '@/components/dashboard/AutoFollowUpCard';
import { FollowUpKPI } from '@/components/dashboard/FollowUpKPI';
import { WhatsAppLink } from '@/components/WhatsAppLink';
import { RelatorioFollowUps } from '@/components/dashboard/RelatorioFollowUps';
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

interface MatriculaItem {
  lead: Lead;
  interacao: Interacao;
}

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  contato_inicial: 'Contato Inicial',
  aula_agendada: 'Experimental Agendada',
  aula_realizada: 'Experimental Realizada',
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
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  
  const [stats, setStats] = useState<Stats>({ total: 0, novos: 0, aulasAgendadas: 0 });
  const [periodStats, setPeriodStats] = useState<PeriodStats>({ experimentaisPeriodo: 0, matriculasPeriodo: 0 });
  const [experimentaisSemanaCount, setExperimentaisSemanaCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Date filter state - inicia com "Todo Histórico" (inclui futuro)
  const [periodType, setPeriodType] = useState<'all' | 'last7days' | 'currentMonth' | 'lastMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState(() => new Date(2020, 0, 1));
  const [endDate, setEndDate] = useState(() => new Date(2030, 11, 31));
  
  // Eventos control state (unified Experimental + Avaliação Física)
  const [eventosHoje, setEventosHoje] = useState<EventoItem[]>([]);
  const [confirmacoesAmanha, setConfirmacoesAmanha] = useState<EventoItem[]>([]);
  const [pendenciasHoje, setPendenciasHoje] = useState<EventoItem[]>([]);
  const [pendenciasAmanha, setPendenciasAmanha] = useState<EventoItem[]>([]);
  const [experimentaisSemana, setExperimentaisSemana] = useState<EventoItem[]>([]);
  
  // Detailed lists state
  const [experimentaisDetalhados, setExperimentaisDetalhados] = useState<EventoItem[]>([]);
  const [matriculasDetalhadas, setMatriculasDetalhadas] = useState<MatriculaItem[]>([]);
  const [showExperimentaisSection, setShowExperimentaisSection] = useState(false);
  const [showMatriculasSection, setShowMatriculasSection] = useState(false);
  
  // Follow-up state
  const [followUpItems, setFollowUpItems] = useState<EventoItem[]>([]);
  const [autoFollowUpItems, setAutoFollowUpItems] = useState<FollowUpAutoItem[]>([]);
  const [showFollowUpSection, setShowFollowUpSection] = useState(false);
  const [followUpTipoFilter, setFollowUpTipoFilter] = useState<string | null>(null);
  const followUpSectionRef = useRef<HTMLDivElement>(null);
  
  // Refs for scrolling
  const experimentaisSectionRef = useRef<HTMLDivElement>(null);
  const matriculasSectionRef = useRef<HTMLDivElement>(null);
  
  // Modal state
  const [reagendarModalOpen, setReagendarModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EventoItem | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const fetchStats = useCallback(async () => {
    if (!unidadeAtual) return;
    
    let query = supabase
      .from('leads')
      .select('*')
      .eq('ativo', true)
      .eq('unidade_id', unidadeAtual.id);

    const { data: leads } = await query;

    if (leads) {
      const typedLeads = leads as unknown as Lead[];
      setStats({
        total: typedLeads.length,
        novos: typedLeads.filter(l => l.status_funil === 'novo').length,
        aulasAgendadas: typedLeads.filter(l => l.status_funil === 'aula_agendada').length,
      });
    }
  }, [unidadeAtual]);

  const fetchPeriodStats = useCallback(async () => {
    if (!unidadeAtual) return;
    
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Fetch experimental count for period - counting unique leads only
    const { data: experimentaisData } = await supabase
      .from('interacoes')
      .select('lead_id')
      .eq('agendou_experimental', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_experimental', startDateStr)
      .lte('data_experimental', endDateStr);

    // Count unique leads with experimental scheduled
    const leadsUnicosExperimentais = new Set(experimentaisData?.map(e => e.lead_id) || []);
    const experimentaisCount = leadsUnicosExperimentais.size;

    // Fetch matriculas count for period - counting unique leads only
    const { data: matriculasData } = await supabase
      .from('interacoes')
      .select('lead_id')
      .eq('fechou_matricula', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_fechamento', startDateStr)
      .lte('data_fechamento', endDateStr);

    // Count unique leads that enrolled
    const leadsUnicosMatriculados = new Set(matriculasData?.map(m => m.lead_id) || []);

    setPeriodStats({
      experimentaisPeriodo: experimentaisCount || 0,
      matriculasPeriodo: leadsUnicosMatriculados.size,
    });
  }, [startDate, endDate, unidadeAtual]);

  const fetchWeeklyStats = useCallback(async () => {
    if (!unidadeAtual) return;
    
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    // Fetch unique leads with experimental scheduled this week
    const { data: weeklyExperimentaisData } = await supabase
      .from('interacoes')
      .select('lead_id')
      .eq('agendou_experimental', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_experimental', weekStart)
      .lte('data_experimental', weekEnd);

    const leadsUnicosSemana = new Set(weeklyExperimentaisData?.map(e => e.lead_id) || []);
    setExperimentaisSemanaCount(leadsUnicosSemana.size);
  }, [unidadeAtual]);

  const fetchEventos = useCallback(async () => {
    if (!unidadeAtual) return;
    
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    const minDate = startDateStr < today ? startDateStr : today;
    const maxDate = endDateStr > tomorrow ? endDateStr : tomorrow;

    // Fetch experimentais
    const { data: experimentaisData } = await supabase
      .from('interacoes')
      .select(`*, leads (id, nome, telefone, email, origem, status_funil, plano_escolhido, cadastrado_por, atendido_por, observacoes, data_aula_experimental, created_by, user_id, ativo, created_at, updated_at)`)
      .eq('agendou_experimental', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_experimental', minDate)
      .lte('data_experimental', maxDate);

    // Fetch avaliações físicas
    const { data: avaliacoesData } = await supabase
      .from('interacoes')
      .select(`*, leads (id, nome, telefone, email, origem, status_funil, plano_escolhido, cadastrado_por, atendido_por, observacoes, data_aula_experimental, created_by, user_id, ativo, created_at, updated_at)`)
      .eq('tipo', 'Avaliação Física')
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_avaliacao', minDate)
      .lte('data_avaliacao', maxDate);

    const todayItems: EventoItem[] = [];
    const tomorrowItems: EventoItem[] = [];
    const pendenciasHojeItems: EventoItem[] = [];
    const pendenciasAmanhaItems: EventoItem[] = [];
    const weekItems: EventoItem[] = [];
    const detailedItems: EventoItem[] = [];

    const processItem = (item: any, tipoEvento: 'experimental' | 'avaliacao') => {
      if (!item.leads || item.leads.ativo === false) return;
      
      const lead: Lead = item.leads as Lead;
      const interacao: Interacao = {
        id: item.id, lead_id: item.lead_id, tipo: item.tipo, descricao: item.descricao,
        data_interacao: item.data_interacao, created_at: item.created_at, created_by: item.created_by,
        atendido_por: item.atendido_por, atendido_por_tipo: item.atendido_por_tipo,
        agendou_experimental: item.agendou_experimental, data_experimental: item.data_experimental,
        hora_experimental: item.hora_experimental, compareceu: item.compareceu, confirmado: item.confirmado,
        reagendou: item.reagendou, fechou_matricula: item.fechou_matricula, plano_escolhido: item.plano_escolhido,
        valor_plano: item.valor_plano, comissao_comercial: item.comissao_comercial,
        comissao_recepcao: item.comissao_recepcao, comissao_cadastrador: item.comissao_cadastrador,
        cadastrado_por: item.cadastrado_por, data_fechamento: item.data_fechamento,
        responsavel_fechamento: item.responsavel_fechamento, treinador_responsavel: item.treinador_responsavel,
        treinador_experimental: item.treinador_experimental, origem_fechamento: item.origem_fechamento,
        quem_agendou: item.quem_agendou, tipo_atendimento: item.tipo_atendimento,
        data_avaliacao: item.data_avaliacao || null, hora_avaliacao: item.hora_avaliacao || null,
        status_avaliacao: item.status_avaliacao || null,
      };

      const eventoItem: EventoItem = { lead, interacao, tipoEvento };
      const dataEvento = tipoEvento === 'avaliacao' ? interacao.data_avaliacao : interacao.data_experimental;
      const isAgendado = tipoEvento === 'avaliacao' 
        ? interacao.status_avaliacao === 'agendada'
        : interacao.compareceu !== true;

      if (dataEvento && dataEvento >= startDateStr && dataEvento <= endDateStr) {
        weekItems.push(eventoItem);
        if (tipoEvento === 'experimental') detailedItems.push(eventoItem);
      }

      if (dataEvento === today && isAgendado) {
        todayItems.push(eventoItem);
        pendenciasHojeItems.push(eventoItem);
      } else if (dataEvento === tomorrow && !interacao.confirmado) {
        tomorrowItems.push(eventoItem);
        pendenciasAmanhaItems.push(eventoItem);
      }
    };

    experimentaisData?.forEach(item => processItem(item, 'experimental'));
    avaliacoesData?.forEach(item => processItem(item, 'avaliacao'));

    // Sort by time
    const sortByTime = (a: EventoItem, b: EventoItem) => {
      const horaA = a.tipoEvento === 'avaliacao' ? a.interacao.hora_avaliacao : a.interacao.hora_experimental;
      const horaB = b.tipoEvento === 'avaliacao' ? b.interacao.hora_avaliacao : b.interacao.hora_experimental;
      return (horaA || '').localeCompare(horaB || '');
    };

    setEventosHoje(todayItems.sort(sortByTime));
    setConfirmacoesAmanha(tomorrowItems.sort(sortByTime));
    setPendenciasHoje(pendenciasHojeItems.sort(sortByTime));
    setPendenciasAmanha(pendenciasAmanhaItems.sort(sortByTime));
    setExperimentaisSemana(weekItems);
    setExperimentaisDetalhados(detailedItems);
  }, [today, tomorrow, startDate, endDate, unidadeAtual]);

  const fetchMatriculas = useCallback(async () => {
    if (!unidadeAtual) return;
    
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
      .eq('unidade_id', unidadeAtual.id)
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
        motivo_perda: null,
        data_perda: null,
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
        data_avaliacao: null,
        hora_avaliacao: null,
        status_avaliacao: null,
      };
      
      matriculaItems.push({ lead, interacao });
    });

    setMatriculasDetalhadas(matriculaItems);
  }, [startDate, endDate, unidadeAtual]);

  const fetchFollowUp = useCallback(async () => {
    if (!unidadeAtual) return;
    
    // Fetch all interacoes where compareceu = true and fechou_matricula is not true
    // This captures all leads that attended experimental but haven't closed
    const { data: followUpData } = await supabase
      .from('interacoes')
      .select(`
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
        tipo_atendimento,
        leads (
          id,
          nome,
          email,
          telefone,
          origem,
          status_funil,
          plano_escolhido,
          data_aula_experimental,
          hora_aula_experimental,
          observacoes,
          atendido_por,
          cadastrado_por,
          ativo,
          user_id,
          created_by,
          created_at,
          updated_at,
          follow_up_whatsapp_enviado,
          follow_up_enviado_em,
          follow_up_responsavel
        )
      `)
      .eq('compareceu', true)
      .eq('agendou_experimental', true)
      .eq('unidade_id', unidadeAtual.id)
      .order('data_experimental', { ascending: false });

    if (!followUpData || followUpData.length === 0) {
      setFollowUpItems([]);
      return;
    }

    const items: EventoItem[] = [];
    const seenLeadIds = new Set<string>();
    
    followUpData.forEach((interacaoData: any) => {
      if (!interacaoData.leads) return;
      if (interacaoData.leads.ativo === false) return;
      if (interacaoData.fechou_matricula === true) return;
      // Filtrar leads com status perdido ou convertido
      if (['perdido', 'convertido'].includes(interacaoData.leads.status_funil)) return;
      // Filtrar leads que já receberam follow-up (verifica truthy para cobrir null/undefined)
      if (interacaoData.leads.follow_up_whatsapp_enviado) return;
      if (seenLeadIds.has(interacaoData.lead_id)) return;
      seenLeadIds.add(interacaoData.lead_id);

      const lead: Lead = {
        id: interacaoData.leads.id, nome: interacaoData.leads.nome, email: interacaoData.leads.email,
        telefone: interacaoData.leads.telefone, origem: interacaoData.leads.origem,
        status_funil: interacaoData.leads.status_funil, plano_escolhido: interacaoData.leads.plano_escolhido,
        data_aula_experimental: interacaoData.leads.data_aula_experimental,
        hora_aula_experimental: interacaoData.leads.hora_aula_experimental,
        observacoes: interacaoData.leads.observacoes, atendido_por: interacaoData.leads.atendido_por,
        cadastrado_por: interacaoData.leads.cadastrado_por, ativo: interacaoData.leads.ativo,
        user_id: interacaoData.leads.user_id, created_by: interacaoData.leads.created_by,
        created_at: interacaoData.leads.created_at, updated_at: interacaoData.leads.updated_at,
        follow_up_whatsapp_enviado: interacaoData.leads.follow_up_whatsapp_enviado || false,
        follow_up_enviado_em: interacaoData.leads.follow_up_enviado_em,
        follow_up_responsavel: interacaoData.leads.follow_up_responsavel,
        motivo_perda: interacaoData.leads.motivo_perda,
        data_perda: interacaoData.leads.data_perda,
      };

      const interacao: Interacao = {
        id: interacaoData.id, lead_id: interacaoData.lead_id, tipo: interacaoData.tipo,
        descricao: interacaoData.descricao, data_interacao: interacaoData.data_interacao,
        created_at: interacaoData.created_at, created_by: interacaoData.created_by,
        atendido_por: interacaoData.atendido_por, atendido_por_tipo: interacaoData.atendido_por_tipo,
        agendou_experimental: interacaoData.agendou_experimental, data_experimental: interacaoData.data_experimental,
        hora_experimental: interacaoData.hora_experimental, compareceu: interacaoData.compareceu,
        confirmado: interacaoData.confirmado, reagendou: interacaoData.reagendou,
        fechou_matricula: interacaoData.fechou_matricula, plano_escolhido: interacaoData.plano_escolhido,
        valor_plano: interacaoData.valor_plano, comissao_comercial: interacaoData.comissao_comercial,
        comissao_recepcao: interacaoData.comissao_recepcao, comissao_cadastrador: interacaoData.comissao_cadastrador,
        cadastrado_por: interacaoData.cadastrado_por, data_fechamento: interacaoData.data_fechamento,
        responsavel_fechamento: interacaoData.responsavel_fechamento, treinador_responsavel: interacaoData.treinador_responsavel,
        treinador_experimental: interacaoData.treinador_experimental, origem_fechamento: interacaoData.origem_fechamento,
        quem_agendou: interacaoData.quem_agendou, tipo_atendimento: interacaoData.tipo_atendimento,
        data_avaliacao: interacaoData.data_avaliacao || null, hora_avaliacao: interacaoData.hora_avaliacao || null,
        status_avaliacao: interacaoData.status_avaliacao || null,
      };
      
      items.push({ lead, interacao, tipoEvento: 'experimental' });
    });

    // Check if any of these leads have closed matricula in other interacoes
    const leadIds = items.map(i => i.lead.id);
    if (leadIds.length > 0) {
      const { data: matriculasData } = await supabase
        .from('interacoes')
        .select('lead_id')
        .in('lead_id', leadIds)
        .eq('fechou_matricula', true);
      
      const closedLeadIds = new Set(matriculasData?.map((m: any) => m.lead_id) || []);
      const filteredItems = items.filter(i => !closedLeadIds.has(i.lead.id));
      setFollowUpItems(filteredItems);
    } else {
      setFollowUpItems(items);
    }
  }, [unidadeAtual]);

  const fetchAutoFollowUps = useCallback(async () => {
    if (!unidadeAtual) return;
    
    // Primeiro, gerar novos follow-ups chamando a edge function
    try {
      const { data, error } = await supabase.functions.invoke('generate-follow-ups', {
        body: { unidade_id: unidadeAtual.id }
      });
      
      if (error) {
        console.error('Erro ao gerar follow-ups:', error);
      } else {
        console.log('Follow-ups gerados:', data);
      }
    } catch (err) {
      console.error('Erro ao chamar edge function:', err);
    }
    
    // Buscar follow-ups pendentes (todos, não apenas os vencidos)
    const { data: followUpsData, error } = await supabase
      .from('follow_ups')
      .select(`
        id,
        lead_id,
        tipo,
        data_referencia,
        data_prevista,
        status,
        concluido_por,
        concluido_em,
        leads (
          id,
          nome,
          telefone,
          email,
          status_funil
        )
      `)
      .eq('unidade_id', unidadeAtual.id)
      .eq('status', 'pendente')
      .order('data_prevista', { ascending: true });

    if (error) {
      console.error('Erro ao buscar follow-ups automáticos:', error);
      return;
    }

    const items: FollowUpAutoItem[] = [];
    followUpsData?.forEach((item: any) => {
      if (!item.leads) return;
      // Filtrar leads com status perdido ou convertido
      if (['perdido', 'convertido'].includes(item.leads.status_funil)) return;
      
      items.push({
        id: item.id,
        lead_id: item.lead_id,
        tipo: item.tipo,
        data_referencia: item.data_referencia,
        data_prevista: item.data_prevista,
        status: item.status,
        concluido_por: item.concluido_por,
        concluido_em: item.concluido_em,
        lead: {
          id: item.leads.id,
          nome: item.leads.nome,
          telefone: item.leads.telefone,
          email: item.leads.email,
          status_funil: item.leads.status_funil,
        },
      });
    });

    setAutoFollowUpItems(items);
  }, [unidadeAtual]);

  const fetchData = useCallback(async () => {
    if (unidadeLoading) return;
    if (!unidadeAtual) {
      setLoading(false);
      return;
    }
    setLoading(true);
    await Promise.all([fetchStats(), fetchEventos(), fetchPeriodStats(), fetchWeeklyStats(), fetchMatriculas(), fetchFollowUp(), fetchAutoFollowUps()]);
    setLoading(false);
  }, [fetchStats, fetchEventos, fetchPeriodStats, fetchWeeklyStats, fetchMatriculas, fetchFollowUp, fetchAutoFollowUps, unidadeAtual, unidadeLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReagendar = (item: EventoItem) => {
    setSelectedItem(item);
    setReagendarModalOpen(true);
  };

  const handleReagendarSuccess = () => {
    fetchEventos();
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
    setFollowUpTipoFilter(null); // Reset filter when clicking the main card
    setTimeout(() => {
      followUpSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleFollowUpTipoClick = (tipo: string) => {
    setShowFollowUpSection(true);
    setShowExperimentaisSection(false);
    setShowMatriculasSection(false);
    setFollowUpTipoFilter(tipo);
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

  return (
    <Layout>
      <div className="p-8">
        {(loading || unidadeLoading) && (
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando experimentais, confirmações e pendências…</span>
          </div>
        )}

        {!unidadeAtual && !unidadeLoading && (
          <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Nenhuma unidade selecionada. Selecione uma unidade no menu lateral para ver os dados.
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            {unidadeAtual && (
              <Badge variant="outline" className="text-sm font-medium px-3 py-1 bg-primary/10 text-primary border-primary/20">
                {unidadeAtual.nome}
              </Badge>
            )}
          </div>
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
              <p className="text-3xl font-bold text-sky-600">{periodStats.experimentaisPeriodo}</p>
              <p className="text-xs text-muted-foreground mt-1">No período</p>
            </CardContent>
          </Card>

          {/* Follow Up KPI - agora conta manuais + automáticos */}
          <FollowUpKPI
            pendingCount={followUpItems.filter(i => !i.lead.follow_up_whatsapp_enviado).length + autoFollowUpItems.length}
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
              <p className="text-3xl font-bold text-purple-600">{experimentaisSemanaCount}</p>
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

        {/* Follow Up Section - Manuais + Automáticos */}
        {showFollowUpSection && (
          <div ref={followUpSectionRef} className="mb-8 space-y-6">
            {/* KPIs e Relatório de Follow-ups */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RelatorioFollowUps onTipoClick={handleFollowUpTipoClick} />
              
              <div className="space-y-6">
                {/* Follow-ups Manuais (pós-experimental sem follow-up enviado) */}
                {followUpItems.length > 0 && !followUpTipoFilter && (
                  <FollowUpCard items={followUpItems} onRefresh={fetchData} />
                )}
                
                {/* Follow-ups Automáticos (D+7, D+15, D+30) */}
                {autoFollowUpItems.length > 0 && (
                  <AutoFollowUpCard 
                    items={autoFollowUpItems} 
                    onRefresh={fetchData} 
                    tipoFilter={followUpTipoFilter}
                    onClearFilter={() => setFollowUpTipoFilter(null)}
                  />
                )}
                
                {/* Mensagem quando não há nenhum */}
                {autoFollowUpItems.length === 0 && followUpItems.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
                      <p>Nenhum follow-up pendente no momento!</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
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
              <EventosHoje
                items={eventosHoje}
                onRefresh={fetchEventos}
                onReagendar={handleReagendar}
              />
              
              <ConfirmacoesAmanha
                items={confirmacoesAmanha}
                onRefresh={fetchEventos}
                onReagendar={handleReagendar}
              />
              
              <PendenciasDia
                pendenciasHoje={pendenciasHoje}
                pendenciasAmanha={pendenciasAmanha}
                followUpsHoje={autoFollowUpItems.filter(item => {
                  const dataPrevista = new Date(item.data_prevista);
                  const hoje = new Date();
                  return dataPrevista.toDateString() === hoje.toDateString();
                })}
                onReagendar={handleReagendar}
                onFollowUpClick={(item) => {
                  // Scroll to follow-up section and open it
                  setShowFollowUpSection(true);
                  setTimeout(() => {
                    followUpSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
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
              onRefresh={fetchEventos}
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
                            <TableCell className="font-medium">{item.lead.nome?.toUpperCase()}</TableCell>
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
                            <TableCell className="font-medium">{item.lead.nome?.toUpperCase()}</TableCell>
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
