import { useState, useCallback, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Lead } from '@/types/database';
import { Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { EventosHoje, EventoItem } from '@/components/dashboard/EventosHoje';
import { ConfirmacoesAmanha } from '@/components/dashboard/ConfirmacoesAmanha';
import { PendenciasDia } from '@/components/dashboard/PendenciasDia';
import { ExperimentaisSemana } from '@/components/dashboard/ExperimentaisSemana';
import { AtividadesDoDia } from '@/components/dashboard/AtividadesDoDia';
import { ReagendarModal } from '@/components/dashboard/ReagendarModal';
import { FollowUpCard } from '@/components/dashboard/FollowUpCard';
import { CompactRelatorioFollowUps } from '@/components/dashboard/CompactRelatorioFollowUps';
import { FollowUpSections } from '@/components/dashboard/FollowUpSections';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardKPIGrid } from '@/components/dashboard/DashboardKPIGrid';
import { ExperimentaisDetailSection } from '@/components/dashboard/ExperimentaisDetailSection';
import { MatriculasDetailSection } from '@/components/dashboard/MatriculasDetailSection';
import { SyncIndicator } from '@/components/dashboard/SyncIndicator';
import { useDashboardData } from '@/hooks/useDashboardData';
import { addDays, subDays, startOfDay, endOfDay } from 'date-fns';
export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  
  // Date filter state
  const [periodType, setPeriodType] = useState<'all' | 'last7days' | 'currentMonth' | 'lastMonth' | 'custom'>('all');
  const [startDate, setStartDate] = useState(() => new Date(2020, 0, 1));
  const [endDate, setEndDate] = useState(() => new Date(2030, 11, 31));
  
  // Section visibility state
  const [showExperimentaisSection, setShowExperimentaisSection] = useState(false);
  const [showMatriculasSection, setShowMatriculasSection] = useState(false);
  const [showFollowUpSection, setShowFollowUpSection] = useState(false);
  const [followUpTipoFilter, setFollowUpTipoFilter] = useState<string | null>(null);
  const [followUpRefreshKey, setFollowUpRefreshKey] = useState(0);
  
  // Refs for scrolling
  const experimentaisSectionRef = useRef<HTMLDivElement>(null);
  const matriculasSectionRef = useRef<HTMLDivElement>(null);
  const followUpSectionRef = useRef<HTMLDivElement>(null);
  
  // Modal state
  const [reagendarModalOpen, setReagendarModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EventoItem | null>(null);

  // Use the main data hook
  const {
    stats,
    periodStats,
    experimentaisSemanaCount,
    eventosHoje,
    confirmacoesAmanha,
    pendenciasHoje,
    pendenciasAmanha,
    experimentaisSemana,
    experimentaisDetalhados,
    followUpItems,
    autoFollowUpItems,
    urgentAutoFollowUpItems,
    upcomingAutoFollowUpItems,
    lastSyncTime,
    matriculasDetalhadas,
    loading,
    refetchAll,
    refetchEventos,
  } = useDashboardData(startDate, endDate);

  const handleReagendar = useCallback((item: EventoItem) => {
    setSelectedItem(item);
    setReagendarModalOpen(true);
  }, []);

  const handleReagendarSuccess = useCallback(() => {
    refetchEventos(startDate, endDate);
  }, [refetchEventos, startDate, endDate]);

  const handleExperimentaisCardClick = useCallback(() => {
    setShowExperimentaisSection(true);
    setShowMatriculasSection(false);
    setShowFollowUpSection(false);
    setTimeout(() => {
      experimentaisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const handleMatriculasCardClick = useCallback(() => {
    setShowMatriculasSection(true);
    setShowExperimentaisSection(false);
    setShowFollowUpSection(false);
    setTimeout(() => {
      matriculasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const handleFollowUpCardClick = useCallback(() => {
    setShowFollowUpSection(true);
    setShowExperimentaisSection(false);
    setShowMatriculasSection(false);
    setFollowUpTipoFilter(null);
    setTimeout(() => {
      followUpSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const handleFollowUpTipoClick = useCallback((tipo: string) => {
    setShowFollowUpSection(true);
    setShowExperimentaisSection(false);
    setShowMatriculasSection(false);
    setFollowUpTipoFilter(tipo);
    setTimeout(() => {
      followUpSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const canEditLead = useCallback((lead: Lead): boolean => {
    if (isAdmin) return true;
    return lead.created_by === user?.id;
  }, [isAdmin, user?.id]);

  const handleDeleteExperimental = useCallback(async (interacaoId: string) => {
    try {
      const { error } = await supabase
        .from('interacoes')
        .update({ agendou_experimental: false, data_experimental: null, hora_experimental: null })
        .eq('id', interacaoId);

      if (error) throw error;
      
      toast.success('Experimental removida com sucesso!');
      refetchAll(startDate, endDate);
    } catch (error) {
      console.error('Erro ao remover experimental:', error);
      toast.error('Erro ao remover experimental');
    }
  }, [refetchAll, startDate, endDate]);

  const handleDeleteMatricula = useCallback(async (interacaoId: string) => {
    try {
      const { error } = await supabase
        .from('interacoes')
        .update({ fechou_matricula: false, data_fechamento: null, valor_plano: null, plano_escolhido: null })
        .eq('id', interacaoId);

      if (error) throw error;
      
      toast.success('Matrícula removida com sucesso!');
      refetchAll(startDate, endDate);
    } catch (error) {
      console.error('Erro ao remover matrícula:', error);
      toast.error('Erro ao remover matrícula');
    }
  }, [refetchAll, startDate, endDate]);

  // KPI shows ONLY urgent items (overdue/today) - never future follow-ups
  const followUpPendingCount = urgentAutoFollowUpItems.length;
  const followUpD1Count = urgentAutoFollowUpItems.filter(item => item.tipo === 'D+1').length;

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

        <div className="flex items-center justify-between mb-2">
          <DashboardHeader
            unidadeNome={unidadeAtual?.nome}
            startDate={startDate}
            endDate={endDate}
            periodType={periodType}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onPeriodTypeChange={setPeriodType}
          />
          <SyncIndicator lastSyncTime={lastSyncTime ?? undefined} className="ml-4" />
        </div>

        <DashboardKPIGrid
          stats={stats}
          periodStats={periodStats}
          experimentaisSemanaCount={experimentaisSemanaCount}
          followUpPendingCount={followUpPendingCount}
          followUpD1Count={followUpD1Count}
          showExperimentaisSection={showExperimentaisSection}
          showMatriculasSection={showMatriculasSection}
          showFollowUpSection={showFollowUpSection}
          onExperimentaisClick={handleExperimentaisCardClick}
          onMatriculasClick={handleMatriculasCardClick}
          onFollowUpClick={handleFollowUpCardClick}
        />

        {/* Follow Up Section */}
        {showFollowUpSection && (
          <div ref={followUpSectionRef} className="mb-8 space-y-4">
            {/* Compact report on top */}
            <CompactRelatorioFollowUps 
              onTipoClick={handleFollowUpTipoClick} 
              refreshKey={followUpRefreshKey}
              activeTipo={followUpTipoFilter}
            />
            
            {/* Follow-up sections: Urgent and Upcoming */}
            <FollowUpSections 
              urgentItems={urgentAutoFollowUpItems}
              upcomingItems={upcomingAutoFollowUpItems}
              onRefresh={() => {
                refetchAll(startDate, endDate);
                setFollowUpRefreshKey(k => k + 1);
              }} 
              tipoFilter={followUpTipoFilter}
              onClearFilter={() => setFollowUpTipoFilter(null)}
              onTipoClick={handleFollowUpTipoClick}
            />
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
              {/* Coluna principal esquerda: Eventos Hoje + Agendamentos Amanhã lado a lado */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <EventosHoje
                  items={eventosHoje}
                  onRefresh={() => refetchEventos(startDate, endDate)}
                  onReagendar={handleReagendar}
                />
                <ConfirmacoesAmanha
                  items={confirmacoesAmanha}
                  onRefresh={() => refetchEventos(startDate, endDate)}
                  onReagendar={handleReagendar}
                />
              </div>

              {/* Coluna lateral direita: Atividades + Pendências empilhados */}
              <div className="space-y-6">
                <AtividadesDoDia onVerRelatorio={handleFollowUpCardClick} />
                <PendenciasDia
                  onVerTodas={() => {
                    setShowFollowUpSection(true);
                    setTimeout(() => {
                      followUpSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  onVerFollowUps={handleFollowUpCardClick}
                  onVerExperimentais={handleExperimentaisCardClick}
                />
              </div>
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
                  setStartDate(startOfDay(subDays(today, 6)));
                  setEndDate(endOfDay(today));
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
              onRefresh={() => refetchEventos(startDate, endDate)}
              startDate={startDate}
              endDate={endDate}
            />
          </TabsContent>
        </Tabs>

        {/* Detailed Experimentais Section */}
        {showExperimentaisSection && (
          <div ref={experimentaisSectionRef} className="mt-8">
            <ExperimentaisDetailSection
              items={experimentaisDetalhados}
              startDate={startDate}
              endDate={endDate}
              onClose={() => setShowExperimentaisSection(false)}
              onDelete={handleDeleteExperimental}
              isAdmin={isAdmin}
              canEditLead={canEditLead}
            />
          </div>
        )}

        {/* Detailed Matrículas Section */}
        {showMatriculasSection && (
          <div ref={matriculasSectionRef} className="mt-8">
            <MatriculasDetailSection
              items={matriculasDetalhadas}
              startDate={startDate}
              endDate={endDate}
              onClose={() => setShowMatriculasSection(false)}
              onDelete={handleDeleteMatricula}
              isAdmin={isAdmin}
              canEditLead={canEditLead}
            />
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
