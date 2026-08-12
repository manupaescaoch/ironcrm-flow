import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useForecastData, RealizadoRow } from '@/hooks/useForecastData';
import { ForecastKPIs } from '@/components/forecast/ForecastKPIs';
import { ForecastInsights } from '@/components/forecast/ForecastInsights';
import { RealUltimoMesCard, ManualRealValores } from '@/components/forecast/RealUltimoMesCard';
import { EficienciaFunilCard } from '@/components/forecast/EficienciaFunilCard';
import { PremissasCard } from '@/components/forecast/PremissasCard';
import { ForecastProximoMesCard } from '@/components/forecast/ForecastProximoMesCard';
import { Projecao12Card } from '@/components/forecast/Projecao12Card';
import { MetaReversaCard } from '@/components/forecast/MetaReversaCard';
import { CenariosCard } from '@/components/forecast/CenariosCard';
import { SemanalCard } from '@/components/forecast/SemanalCard';
import { AlavancasCard } from '@/components/forecast/AlavancasCard';
import { HistoricoCard } from '@/components/forecast/HistoricoCard';
import {
  MESES,
  Premissas,
  RealMes,
  calcAlavancas,
  calcEficiencia,
  calcForecastMes,
  calcInsights,
  calcMetaReversa,
  calcProjecao12,
  fmtMesAno,
  montaSemanas,
  num,
  proximoMes,
  safeDiv,
} from '@/lib/forecast';

const hoje = new Date();

function metricasDaLinha(r: RealizadoRow) {
  const leads = num(r.leads_crm);
  const exp = num(r.experimentais_marcadas);
  const comp = num(r.comparecimentos);
  const mat = num(r.matriculas_total);
  const base = num(r.base_inicial);
  return {
    cpl: safeDiv(num(r.investimento_real), leads),
    aproveitamento: safeDiv(leads, num(r.conversas_iniciadas)),
    leadExp: safeDiv(exp, leads),
    comparecimento: safeDiv(comp, exp),
    expMat: safeDiv(mat, comp),
    evasao: safeDiv(num(r.cancelamentos), base),
    ticket: num(r.ticket_medio),
    investimento: num(r.investimento_real),
  };
}

export default function Forecast() {
  const { unidadesPermitidas, unidadeAtual, setUnidadeAtual, loading: unidadeLoading } = useUnidade();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const unidadeId = unidadeAtual?.id ?? null;
  const {
    realizados,
    premissasRow,
    semanalRows,
    autoAnterior,
    mesAnteriorRef,
    loading,
    refetchAll,
    salvarPremissas,
    salvarRealizado,
    fecharMes,
    reabrirMes,
    salvarSemana,
  } = useForecastData(unidadeId, mes, ano);

  // -------------------------------------------------- real do mês anterior
  const rowAnterior = useMemo(
    () => realizados.find((r) => r.ano === mesAnteriorRef.ano && r.mes === mesAnteriorRef.mes) ?? null,
    [realizados, mesAnteriorRef],
  );

  const real: RealMes = useMemo(() => {
    const auto = autoAnterior;
    const leads = rowAnterior?.fechado ? num(rowAnterior.leads_crm) : num(auto?.leads ?? rowAnterior?.leads_crm);
    const experimentais = rowAnterior?.fechado
      ? num(rowAnterior.experimentais_marcadas)
      : num(auto?.experimentais ?? rowAnterior?.experimentais_marcadas);
    const comparecimentos = rowAnterior?.fechado
      ? num(rowAnterior.comparecimentos)
      : num(auto?.comparecimentos ?? rowAnterior?.comparecimentos);
    const matriculas = rowAnterior?.fechado
      ? num(rowAnterior.matriculas_total)
      : num(auto?.matriculas ?? rowAnterior?.matriculas_total);
    const matriculasTrafego = rowAnterior?.fechado
      ? num(rowAnterior.matriculas_trafego)
      : num(auto?.matriculasTrafego ?? rowAnterior?.matriculas_trafego);
    const ticketMedio = rowAnterior?.fechado
      ? num(rowAnterior.ticket_medio)
      : num(auto?.ticketMedio ?? rowAnterior?.ticket_medio);
    const investimento = num(rowAnterior?.investimento_real ?? auto?.investimento ?? 0);
    const baseInicial = num(rowAnterior?.base_inicial);
    const cancelamentos = num(rowAnterior?.cancelamentos);
    const alunosAtivos = num(rowAnterior?.alunos_ativos ?? rowAnterior?.base_final);
    return {
      ano: mesAnteriorRef.ano,
      mes: mesAnteriorRef.mes,
      investimento,
      conversas: num(rowAnterior?.conversas_iniciadas),
      leads,
      experimentais,
      comparecimentos,
      matriculas,
      matriculasTrafego,
      ticketMedio,
      alunosAtivos: alunosAtivos || baseInicial + matriculas - cancelamentos,
      baseInicial,
      cancelamentos,
      evasaoPct: safeDiv(cancelamentos, baseInicial),
      fechado: !!rowAnterior?.fechado,
    };
  }, [rowAnterior, autoAnterior, mesAnteriorRef]);

  const ef = useMemo(() => calcEficiencia(real), [real]);

  // ------------------------------------------------------------- premissas
  const premissasPadrao: Premissas = useMemo(
    () => ({
      investimento: num(premissasRow?.investimento_previsto) || real.investimento,
      cpl: num(premissasRow?.cpl_projetado) || ef.cpl,
      leadExp: num(premissasRow?.taxa_lead_agendamento) || ef.leadExp,
      comparecimento: num(premissasRow?.taxa_agendamento_comparecimento) || ef.comparecimento,
      expMat: num(premissasRow?.taxa_comparecimento_matricula) || ef.expMat,
      evasao: num(premissasRow?.churn_mensal) || ef.evasaoPct,
      mensalidade: num(premissasRow?.mensalidade_media) || num(premissasRow?.ticket_medio) || real.ticketMedio,
      baseInicial: num(premissasRow?.base_inicial) || real.alunosAtivos,
      capacidade: num(premissasRow?.capacidade_maxima) || 0,
      metaAlunos: num(premissasRow?.meta_alunos) || 0,
      aproveitamentoAtendimento:
        num(premissasRow?.aproveitamento_atendimento) ||
        num(premissasRow?.taxa_conversa_lead) ||
        ef.aproveitamentoAtendimento,
    }),
    [premissasRow, ef, real],
  );

  const [premissas, setPremissas] = useState<Premissas>(premissasPadrao);
  useEffect(() => setPremissas(premissasPadrao), [premissasPadrao]);

  // média dos últimos N meses registrados
  const aplicarMedia = (n: 1 | 3 | 6) => {
    const base = [...realizados]
      .sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes))
      .slice(0, n)
      .map(metricasDaLinha);
    if (!base.length) return;
    const med = (k: keyof ReturnType<typeof metricasDaLinha>) =>
      base.reduce((a, r) => a + num(r[k]), 0) / base.length;
    setPremissas((p) => ({
      ...p,
      cpl: med('cpl') || p.cpl,
      leadExp: med('leadExp') || p.leadExp,
      comparecimento: med('comparecimento') || p.comparecimento,
      expMat: med('expMat') || p.expMat,
      evasao: med('evasao') || p.evasao,
      mensalidade: med('ticket') || p.mensalidade,
      aproveitamentoAtendimento: med('aproveitamento') || p.aproveitamentoAtendimento,
    }));
  };

  // -------------------------------------------------------------- projeções
  const forecastMes = useMemo(() => calcForecastMes(premissas), [premissas]);
  const linhas = useMemo(() => calcProjecao12(premissas, mes, ano), [premissas, mes, ano]);
  const alavancas = useMemo(() => calcAlavancas(premissas, mes, ano), [premissas, mes, ano]);

  const [metaReversaAlunos, setMetaReversaAlunos] = useState(0);
  const [prazoMeses, setPrazoMeses] = useState(12);
  useEffect(() => {
    setMetaReversaAlunos(premissas.metaAlunos || premissas.baseInicial);
  }, [premissas.metaAlunos, premissas.baseInicial]);

  const mr = useMemo(
    () => calcMetaReversa(premissas, metaReversaAlunos, prazoMeses),
    [premissas, metaReversaAlunos, prazoMeses],
  );
  const insights = useMemo(() => calcInsights(premissas, ef, linhas, mr), [premissas, ef, linhas, mr]);

  const semanas = useMemo(
    () => montaSemanas(semanalRows, premissas.evasao || 0.05),
    [semanalRows, premissas.evasao],
  );

  // ----------------------------------------------------------------- ações
  const patchReal = (v: ManualRealValores) => ({
    ano: mesAnteriorRef.ano,
    mes: mesAnteriorRef.mes,
    conversas_iniciadas: Math.round(v.conversas),
    investimento_real: v.investimento,
    base_inicial: Math.round(v.baseInicial),
    cancelamentos: Math.round(v.cancelamentos),
    alunos_ativos: Math.round(v.alunosAtivos),
    base_final: Math.round(v.alunosAtivos),
    leads_crm: real.leads,
    experimentais_marcadas: real.experimentais,
    comparecimentos: real.comparecimentos,
    matriculas_total: real.matriculas,
    matriculas_trafego: real.matriculasTrafego,
    ticket_medio: real.ticketMedio,
  });

  const handleFechar = (v: ManualRealValores) => {
    fecharMes.mutate(patchReal(v), {
      onSuccess: () => {
        // o fechamento vira a base inicial do mês seguinte
        salvarPremissas.mutate({
          investimento_previsto: premissas.investimento,
          cpl_projetado: premissas.cpl,
          taxa_lead_agendamento: premissas.leadExp,
          taxa_agendamento_comparecimento: premissas.comparecimento,
          taxa_comparecimento_matricula: premissas.expMat,
          taxa_conversa_lead: premissas.aproveitamentoAtendimento,
          aproveitamento_atendimento: premissas.aproveitamentoAtendimento,
          churn_mensal: premissas.evasao,
          mensalidade_media: premissas.mensalidade,
          base_inicial: Math.round(v.alunosAtivos),
          capacidade_maxima: Math.round(premissas.capacidade),
          meta_alunos: Math.round(premissas.metaAlunos),
        });
      },
    });
  };

  const handleSalvarPremissas = () =>
    salvarPremissas.mutate({
      investimento_previsto: premissas.investimento,
      cpl_projetado: premissas.cpl,
      taxa_lead_agendamento: premissas.leadExp,
      taxa_agendamento_comparecimento: premissas.comparecimento,
      taxa_comparecimento_matricula: premissas.expMat,
      taxa_conversa_lead: premissas.aproveitamentoAtendimento,
      aproveitamento_atendimento: premissas.aproveitamentoAtendimento,
      churn_mensal: premissas.evasao,
      mensalidade_media: premissas.mensalidade,
      ticket_medio: premissas.mensalidade,
      base_inicial: Math.round(premissas.baseInicial),
      capacidade_maxima: Math.round(premissas.capacidade),
      meta_alunos: Math.round(premissas.metaAlunos),
    });

  const prox = proximoMes(mes, ano);
  const anos = [ano - 2, ano - 1, ano, ano + 1];

  return (
    <Layout>
      <div className="space-y-5 pb-10">
        {/* Cabeçalho */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">EVO | FORECAST DE ALUNOS</h1>
              {unidadeAtual && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  {unidadeAtual.nome}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Projeção de crescimento, aquisição, evasão e capacidade da unidade.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={unidadeId ?? ''}
              onValueChange={(v) => {
                const u = unidadesPermitidas.find((x) => x.id === v);
                if (u) setUnidadeAtual(u);
              }}
            >
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {unidadesPermitidas.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-[110px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-9" onClick={refetchAll}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar projeção
            </Button>
          </div>
        </div>

        {unidadeLoading || loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !unidadeId ? (
          <p className="text-sm text-muted-foreground">Selecione uma unidade para ver o forecast.</p>
        ) : (
          <>
            <ForecastKPIs premissas={premissas} real={real} ef={ef} />

            <ForecastInsights insights={insights} />

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <RealUltimoMesCard
                  real={real}
                  label={fmtMesAno(mesAnteriorRef.mes, mesAnteriorRef.ano)}
                  fechado={real.fechado}
                  salvando={salvarRealizado.isPending || fecharMes.isPending}
                  onSalvar={(v) => salvarRealizado.mutate(patchReal(v))}
                  onFechar={handleFechar}
                  onReabrir={() => rowAnterior && reabrirMes.mutate({ id: rowAnterior.id })}
                />
              </div>
              <EficienciaFunilCard
                ef={ef}
                premissas={premissas}
                metas={{
                  leadExp: premissas.leadExp,
                  comparecimento: premissas.comparecimento,
                  expMat: premissas.expMat,
                  cpl: premissas.cpl,
                  cac: safeDiv(premissas.investimento, forecastMes.matriculas),
                  evasao: premissas.evasao,
                }}
              />
            </div>

            <PremissasCard
              premissas={premissas}
              onChange={setPremissas}
              onSalvar={handleSalvarPremissas}
              onAplicarMedia={aplicarMedia}
              salvando={salvarPremissas.isPending}
            />

            <ForecastProximoMesCard
              f={forecastMes}
              premissas={premissas}
              label={fmtMesAno(prox.mes, prox.ano)}
            />

            <Projecao12Card linhas={linhas} premissas={premissas} />

            <MetaReversaCard
              mr={mr}
              meta={metaReversaAlunos}
              prazo={prazoMeses}
              onMeta={setMetaReversaAlunos}
              onPrazo={setPrazoMeses}
            />

            <CenariosCard premissas={premissas} />

            <SemanalCard
              semanas={semanas}
              metaEvasaoMensal={premissas.evasao || 0.05}
              onSalvar={(row) => salvarSemana.mutate({ ...row })}
            />

            <AlavancasCard alavancas={alavancas} />

            <HistoricoCard rows={realizados} />
          </>
        )}
      </div>
    </Layout>
  );
}
