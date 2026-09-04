import { useCallback, useMemo, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useFollowUpsMatriculados } from '@/hooks/useFollowUpsMatriculados';
import { useFollowUpsGerente } from '@/hooks/useFollowUpsGerente';
import { useOpsGestao } from '@/hooks/useOpsGestao';
import { EventosHoje, EventoItem } from '@/components/dashboard/EventosHoje';
import { ConfirmacoesAmanha } from '@/components/dashboard/ConfirmacoesAmanha';
import { ExperimentaisSemana } from '@/components/dashboard/ExperimentaisSemana';
import { PendenciasDia } from '@/components/dashboard/PendenciasDia';
import { AtividadesDoDia } from '@/components/dashboard/AtividadesDoDia';
import { ReagendarModal } from '@/components/dashboard/ReagendarModal';
import { FollowUpSections } from '@/components/dashboard/FollowUpSections';
import { CompactRelatorioFollowUps } from '@/components/dashboard/CompactRelatorioFollowUps';
import { FollowUpMatriculadosSection } from '@/components/dashboard/FollowUpMatriculadosSection';
import { FollowUpGerenteSection } from '@/components/dashboard/FollowUpGerenteSection';
import { SyncIndicator } from '@/components/dashboard/SyncIndicator';
import { OperacaoKPIRow } from '@/components/operacao/OperacaoKPIRow';
import { AtividadesUnidadeResumo } from '@/components/operacao/AtividadesUnidadeResumo';
import { TarefasDeHojeList } from '@/components/operacao/TarefasDeHojeList';
import { AtencaoCard, AtencaoItem } from '@/components/operacao/AtencaoCard';

export default function Operacao() {
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();

  // Período fixo (visão do dia/semana) — a operação é sempre "hoje"
  const [startDate] = useState(() => new Date(2020, 0, 1));
  const [endDate] = useState(() => new Date(2030, 11, 31));

  const [showFollowUpSection, setShowFollowUpSection] = useState(false);
  const [showFollowUpMatriculadosSection, setShowFollowUpMatriculadosSection] = useState(false);
  const [showFollowUpGerenteSection, setShowFollowUpGerenteSection] = useState(false);
  const [showExperimentaisSemana, setShowExperimentaisSemana] = useState(false);
  const [followUpTipoFilter, setFollowUpTipoFilter] = useState<string | null>(null);
  const [followUpRefreshKey, setFollowUpRefreshKey] = useState(0);
  const [naoCompareceuNonce, setNaoCompareceuNonce] = useState(0);

  const [reagendarModalOpen, setReagendarModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EventoItem | null>(null);

  const followUpSectionRef = useRef<HTMLDivElement>(null);
  const followUpMatriculadosSectionRef = useRef<HTMLDivElement>(null);
  const followUpGerenteSectionRef = useRef<HTMLDivElement>(null);
  const experimentaisSemanaRef = useRef<HTMLDivElement>(null);
  const tarefasRef = useRef<HTMLDivElement>(null);

  const {
    periodStats,
    experimentaisSemanaCount,
    eventosHoje,
    confirmacoesAmanha,
    experimentaisSemana,
    urgentAutoFollowUpItems,
    upcomingAutoFollowUpItems,
    lastSyncTime,
    loading,
    refetchAll,
    refetchEventos,
  } = useDashboardData(startDate, endDate);

  const { urgentItems: urgentMatriculadosFU, refetch: refetchMatriculadosFU } = useFollowUpsMatriculados();
  const { urgentItems: urgentGerenteFU, refetch: refetchGerenteFU } = useFollowUpsGerente();

  const { tarefas, resumoPorUnidade, isLoading: tarefasLoading } = useOpsGestao();

  const tarefasUnidade = useMemo(
    () => (unidadeAtual ? tarefas.filter((t) => t.unidade_id === unidadeAtual.id) : []),
    [tarefas, unidadeAtual],
  );

  const resumo = useMemo(
    () => resumoPorUnidade.find((r) => r.unidade_id === unidadeAtual?.id),
    [resumoPorUnidade, unidadeAtual],
  );

  const followUpPendingCount = urgentAutoFollowUpItems.length;
  const followUpD1Count = urgentAutoFollowUpItems.filter((i) => i.tipo === 'D+1').length;
  const naoCompareceram = Math.max(
    0,
    periodStats.experimentaisPeriodo - periodStats.comparecimentosPeriodo,
  );

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleFollowUpClick = useCallback(() => {
    setShowFollowUpSection(true);
    setFollowUpTipoFilter(null);
    scrollTo(followUpSectionRef);
  }, []);

  const handleFollowUpTipoClick = useCallback((tipo: string) => {
    setShowFollowUpSection(true);
    setFollowUpTipoFilter(tipo);
    scrollTo(followUpSectionRef);
  }, []);

  const handleFollowUpMatriculadosClick = useCallback(() => {
    setShowFollowUpMatriculadosSection(true);
    scrollTo(followUpMatriculadosSectionRef);
  }, []);

  const handleFollowUpGerenteClick = useCallback(() => {
    setShowFollowUpGerenteSection(true);
    scrollTo(followUpGerenteSectionRef);
  }, []);

  const handleExperimentaisClick = useCallback(() => {
    setShowExperimentaisSemana(true);
    setNaoCompareceuNonce(0);
    scrollTo(experimentaisSemanaRef);
  }, []);

  const handleNaoCompareceramClick = useCallback(() => {
    setShowExperimentaisSemana(true);
    setNaoCompareceuNonce((n) => n + 1);
    scrollTo(experimentaisSemanaRef);
  }, []);

  const handleReagendar = useCallback((item: EventoItem) => {
    setSelectedItem(item);
    setReagendarModalOpen(true);
  }, []);

  const atencaoItems: AtencaoItem[] = useMemo(() => {
    const semConfirmacao = confirmacoesAmanha.filter(
      (e) => !(e.lead as unknown as { confirmacao_24h_enviada_em?: string | null })?.confirmacao_24h_enviada_em,
    ).length;
    const criticasAtrasadas = tarefasUnidade.filter(
      (t) => t.status === 'atrasada' && t.prioridade === 'critica',
    ).length;
    const atrasadas = tarefasUnidade.filter((t) => t.status === 'atrasada').length;

    return [
      {
        id: 'confirmacoes',
        label: 'agendamentos de amanhã sem confirmação enviada',
        count: semConfirmacao,
        tone: 'warning',
        onClick: handleExperimentaisClick,
      },
      {
        id: 'followups',
        label: 'follow-ups aguardando contato',
        count: followUpPendingCount,
        tone: 'warning',
        onClick: handleFollowUpClick,
      },
      {
        id: 'criticas',
        label: 'tarefas críticas atrasadas',
        count: criticasAtrasadas,
        tone: 'critical',
        onClick: () => scrollTo(tarefasRef),
      },
      {
        id: 'atrasadas',
        label: 'tarefas atrasadas na unidade',
        count: atrasadas - criticasAtrasadas > 0 ? atrasadas - criticasAtrasadas : 0,
        tone: 'warning',
        onClick: () => scrollTo(tarefasRef),
      },
      {
        id: 'nao-compareceram',
        label: 'alunos que não compareceram e exigem contato',
        count: naoCompareceram,
        tone: 'warning',
        onClick: handleNaoCompareceramClick,
      },
    ];
  }, [
    confirmacoesAmanha,
    tarefasUnidade,
    followUpPendingCount,
    naoCompareceram,
    handleExperimentaisClick,
    handleFollowUpClick,
    handleNaoCompareceramClick,
  ]);

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Operação</h1>
            {unidadeAtual?.nome && (
              <Badge
                variant="outline"
                className="text-sm font-medium px-3 py-1 bg-primary/10 text-primary border-primary/20"
              >
                {unidadeAtual.nome}
              </Badge>
            )}
          </div>
          <SyncIndicator lastSyncTime={lastSyncTime ?? undefined} />
        </div>

        <p className="text-sm text-muted-foreground -mt-4">
          O que precisa acontecer hoje nesta unidade.
        </p>

        {(loading || unidadeLoading) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando operação do dia…</span>
          </div>
        )}

        {!unidadeAtual && !unidadeLoading && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Nenhuma unidade selecionada. Selecione uma unidade no menu lateral para ver os dados.
          </div>
        )}

        <OperacaoKPIRow
          followUpPendingCount={followUpPendingCount}
          followUpD1Count={followUpD1Count}
          followUpMatriculadosCount={urgentMatriculadosFU.length}
          followUpGerenteCount={urgentGerenteFU.length}
          naoCompareceram={naoCompareceram}
          experimentaisSemanaCount={experimentaisSemanaCount}
          comparecimentos={periodStats.comparecimentosPeriodo}
          agendados={periodStats.experimentaisPeriodo}
          showFollowUpSection={showFollowUpSection}
          showFollowUpMatriculadosSection={showFollowUpMatriculadosSection}
          showFollowUpGerenteSection={showFollowUpGerenteSection}
          showExperimentaisSemana={showExperimentaisSemana}
          isNaoCompareceramActive={naoCompareceuNonce > 0}
          onFollowUpClick={handleFollowUpClick}
          onFollowUpMatriculadosClick={handleFollowUpMatriculadosClick}
          onFollowUpGerenteClick={handleFollowUpGerenteClick}
          onNaoCompareceramClick={handleNaoCompareceramClick}
          onExperimentaisClick={handleExperimentaisClick}
        />

        {atencaoItems.some((i) => i.count > 0) && <AtencaoCard items={atencaoItems} />}

        {showFollowUpMatriculadosSection && (
          <div ref={followUpMatriculadosSectionRef} className="space-y-4">
            <FollowUpMatriculadosSection
              urgentItems={urgentMatriculadosFU}
              onRefresh={refetchMatriculadosFU}
            />
          </div>
        )}

        {showFollowUpGerenteSection && (
          <div ref={followUpGerenteSectionRef} className="space-y-4">
            <FollowUpGerenteSection urgentItems={urgentGerenteFU} onRefresh={refetchGerenteFU} />
          </div>
        )}

        {showFollowUpSection && (
          <div ref={followUpSectionRef} className="space-y-4">
            <CompactRelatorioFollowUps
              onTipoClick={handleFollowUpTipoClick}
              refreshKey={followUpRefreshKey}
              activeTipo={followUpTipoFilter}
            />
            <FollowUpSections
              urgentItems={urgentAutoFollowUpItems}
              upcomingItems={upcomingAutoFollowUpItems}
              onRefresh={() => {
                refetchAll(startDate, endDate);
                setFollowUpRefreshKey((k) => k + 1);
              }}
              tipoFilter={followUpTipoFilter}
              onClearFilter={() => setFollowUpTipoFilter(null)}
              onTipoClick={handleFollowUpTipoClick}
            />
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground/80">Controle do Dia</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div ref={tarefasRef} className="space-y-4">
              <AtividadesUnidadeResumo
                previstas={resumo?.total ?? 0}
                concluidas={resumo?.concluidas ?? 0}
                emAndamento={resumo?.emAndamento ?? 0}
                atrasadas={resumo?.atrasadas ?? 0}
                percentual={resumo?.percentual ?? 0}
              />
              <TarefasDeHojeList tarefas={tarefasUnidade} loading={tarefasLoading} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AtividadesDoDia onVerRelatorio={handleFollowUpClick} />
          <PendenciasDia
            onVerTodas={handleFollowUpClick}
            onVerFollowUps={handleFollowUpClick}
            onVerExperimentais={handleExperimentaisClick}
          />
        </section>

        {showExperimentaisSemana && (
          <div ref={experimentaisSemanaRef}>
            <ExperimentaisSemana
              key={`exp-semana-${naoCompareceuNonce}`}
              items={experimentaisSemana}
              onReagendar={handleReagendar}
              onRefresh={() => refetchEventos(startDate, endDate)}
              startDate={startDate}
              endDate={endDate}
              initialStatusFilter={naoCompareceuNonce > 0 ? 'nao_compareceu' : 'todos'}
            />
          </div>
        )}

        <ReagendarModal
          open={reagendarModalOpen}
          onOpenChange={setReagendarModalOpen}
          item={selectedItem}
          onSuccess={() => refetchEventos(startDate, endDate)}
        />
      </div>
    </Layout>
  );
}
