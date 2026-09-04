import { useState, useCallback, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Lead } from '@/types/database';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { EventoItem } from '@/components/dashboard/EventosHoje';
import { ExperimentaisSemana } from '@/components/dashboard/ExperimentaisSemana';
import { ReagendarModal } from '@/components/dashboard/ReagendarModal';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardKPIGrid } from '@/components/dashboard/DashboardKPIGrid';
import { MetaVsRealizadoCard } from '@/components/dashboard/MetaVsRealizadoCard';
import { ExperimentaisDetailSection } from '@/components/dashboard/ExperimentaisDetailSection';
import { MatriculasDetailSection } from '@/components/dashboard/MatriculasDetailSection';
import { SyncIndicator } from '@/components/dashboard/SyncIndicator';
import { useDashboardData } from '@/hooks/useDashboardData';
import { startOfDay, subDays, endOfDay } from 'date-fns';

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
  const [showPeriodoSection, setShowPeriodoSection] = useState(false);
  const [alunosAtivosRefreshKey, setAlunosAtivosRefreshKey] = useState(0);

  // Refs for scrolling
  const experimentaisSectionRef = useRef<HTMLDivElement>(null);
  const periodoSectionRef = useRef<HTMLDivElement>(null);
  const matriculasSectionRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [reagendarModalOpen, setReagendarModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EventoItem | null>(null);

  const {
    stats,
    periodStats,
    experimentaisSemana,
    experimentaisDetalhados,
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

  const handleMatriculasCardClick = useCallback(() => {
    setShowMatriculasSection(true);
    setShowExperimentaisSection(false);
    setTimeout(() => {
      matriculasSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
        {(loading || unidadeLoading) && (
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando indicadores da unidade…</span>
          </div>
        )}

        {!unidadeAtual && !unidadeLoading && (
          <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Nenhuma unidade selecionada. Selecione uma unidade no menu lateral para ver os dados.
          </div>
        )}

        <div className="flex items-start justify-between gap-4 mb-2">
          <DashboardHeader
            unidadeNome={unidadeAtual?.nome}
            startDate={startDate}
            endDate={endDate}
            periodType={periodType}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onPeriodTypeChange={setPeriodType}
          />
          <SyncIndicator lastSyncTime={lastSyncTime ?? undefined} className="ml-4 shrink-0" />
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Como está a performance da unidade.
        </p>

        <div className="space-y-2">
          <MetaVsRealizadoCard
            unidadeId={unidadeAtual?.id}
            unidadeNome={unidadeAtual?.nome}
            refreshKey={alunosAtivosRefreshKey}
          />

          <DashboardKPIGrid
            stats={stats}
            periodStats={periodStats}
            unidadeId={unidadeAtual?.id}
            alunosAtivosRefreshKey={alunosAtivosRefreshKey}
            onAlunosAtivosChange={() => setAlunosAtivosRefreshKey(k => k + 1)}
            showMatriculasSection={showMatriculasSection}
            onMatriculasClick={handleMatriculasCardClick}
          />
        </div>

        {/* Visão do Período */}
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={showPeriodoSection ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setShowPeriodoSection((v) => !v);
                if (!showPeriodoSection) {
                  setTimeout(() => {
                    periodoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }
              }}
            >
              {showPeriodoSection ? 'Ocultar visão do período' : 'Visão do período'}
            </Button>
            <Button
              variant={showExperimentaisSection ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setShowExperimentaisSection((v) => !v);
                setTimeout(() => {
                  experimentaisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }}
            >
              Detalhar experimentais
            </Button>
          </div>

          {showPeriodoSection && (
            <div className="space-y-4">
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

              <div ref={periodoSectionRef}>
                <ExperimentaisSemana
                  items={experimentaisSemana}
                  onReagendar={handleReagendar}
                  onRefresh={() => refetchEventos(startDate, endDate)}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
            </div>
          )}
        </div>

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
