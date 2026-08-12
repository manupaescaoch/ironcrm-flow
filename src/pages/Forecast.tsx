import { useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useForecastBaseAtual, useForecastConfig, useForecastRealizadoAuto } from '@/hooks/useForecast';
import { projetarMes, projetarMeses, type ForecastPremissas } from '@/lib/forecast/calc';
import { PremissasEditor } from '@/components/forecast/PremissasEditor';
import { FunilForecastCard } from '@/components/forecast/FunilForecastCard';
import { ProjecaoDozeMesesCard } from '@/components/forecast/ProjecaoDozeMesesCard';
import { MetaReversaCard } from '@/components/forecast/MetaReversaCard';
import { SimuladorCard } from '@/components/forecast/SimuladorCard';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const fmt = (v: number | null | undefined, dec = 0) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const brl = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function Forecast() {
  const { isAdmin } = useAuth();
  const { unidadeAtual } = useUnidade();
  const hoje = new Date();

  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);

  const unidadeId = unidadeAtual?.id;
  const { premissas, realizado, metas } = useForecastConfig(unidadeId, ano);
  const realizadoAuto = useForecastRealizadoAuto(unidadeId, ano);
  const baseAtual = useForecastBaseAtual(unidadeId);

  const premissaMes = premissas.data?.find((p) => p.mes === mes);
  const realizadoMes = realizado.data?.find((r) => r.mes === mes);
  const metaMes = metas.data?.find((m) => m.mes === mes);
  const autoMes = realizadoAuto.data?.find((r) => r.mes === mes);

  const baseInicial =
    realizadoMes?.base_inicial ?? baseAtual.data?.alunosAtivos ?? null;

  const valores: ForecastPremissas = useMemo(
    () => ({
      investimentoPrevisto: Number(premissaMes?.investimento_previsto ?? autoMes?.investimento ?? 0),
      custoPorConversa: premissaMes?.custo_por_conversa != null ? Number(premissaMes.custo_por_conversa) : null,
      taxaConversaLead: Number(premissaMes?.taxa_conversa_lead ?? 0),
      taxaLeadAgendamento: Number(premissaMes?.taxa_lead_agendamento ?? 0),
      taxaAgendamentoComparecimento: Number(premissaMes?.taxa_agendamento_comparecimento ?? 0),
      taxaComparecimentoMatricula: Number(premissaMes?.taxa_comparecimento_matricula ?? 0),
      churnMensal: Number(premissaMes?.churn_mensal ?? 0),
      ticketMedio:
        premissaMes?.ticket_medio != null
          ? Number(premissaMes.ticket_medio)
          : baseAtual.data?.ticketMedio ?? autoMes?.ticketMedio ?? null,
      capacidadeMaxima:
        premissaMes?.capacidade_maxima != null ? Number(premissaMes.capacidade_maxima) : baseAtual.data?.capacidade ?? null,
    }),
    [premissaMes, autoMes, baseAtual.data],
  );

  const projecaoMes = useMemo(
    () =>
      projetarMes({
        ano,
        mes,
        baseInicial: baseInicial ?? 0,
        premissas: valores,
        conversasInformadas: realizadoMes?.conversas_iniciadas ?? null,
      }),
    [ano, mes, baseInicial, valores, realizadoMes?.conversas_iniciadas],
  );

  const doze = useMemo(() => {
    if (baseInicial == null) return [];
    return projetarMeses({
      anoInicial: ano,
      mesInicial: mes,
      baseInicial,
      meses: 12,
      premissasPorMes: (a, m) => {
        const p = a === ano ? premissas.data?.find((x) => x.mes === m) : undefined;
        if (!p) return valores;
        return {
          investimentoPrevisto: Number(p.investimento_previsto ?? 0),
          custoPorConversa: p.custo_por_conversa != null ? Number(p.custo_por_conversa) : valores.custoPorConversa,
          taxaConversaLead: Number(p.taxa_conversa_lead ?? 0),
          taxaLeadAgendamento: Number(p.taxa_lead_agendamento ?? 0),
          taxaAgendamentoComparecimento: Number(p.taxa_agendamento_comparecimento ?? 0),
          taxaComparecimentoMatricula: Number(p.taxa_comparecimento_matricula ?? 0),
          churnMensal: Number(p.churn_mensal ?? 0),
          ticketMedio: p.ticket_medio != null ? Number(p.ticket_medio) : valores.ticketMedio,
          capacidadeMaxima: p.capacidade_maxima != null ? Number(p.capacidade_maxima) : valores.capacidadeMaxima,
        };
      },
    });
  }, [baseInicial, ano, mes, premissas.data, valores]);

  const loading = premissas.isLoading || realizado.isLoading || baseAtual.isLoading;

  const kpis = [
    { label: 'Base de alunos hoje', valor: fmt(baseInicial) },
    { label: 'Matrículas previstas', valor: fmt(projecaoMes.funil.matriculas, 1) },
    { label: 'Base no fim do mês', valor: fmt(projecaoMes.baseFinal, 1) },
    { label: 'Ocupação prevista', valor: projecaoMes.ocupacao == null ? '—' : `${fmt(projecaoMes.ocupacao, 1)}%` },
    { label: 'Receita prevista', valor: brl(projecaoMes.receitaPrevista) },
    { label: 'CAC previsto', valor: brl(projecaoMes.cac) },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <TrendingUp className="h-6 w-6 text-primary" />
              Forecast
            </h1>
            <p className="text-sm text-muted-foreground">
              Projeção de alunos ativos a partir do investimento em tráfego
              {unidadeAtual ? ` — ${unidadeAtual.nome}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-[150px]">
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
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : !unidadeAtual ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Selecione uma unidade para ver a projeção.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="mes" className="space-y-4">
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="mes">Projeção do Mês</TabsTrigger>
              <TabsTrigger value="doze">12 Meses</TabsTrigger>
              <TabsTrigger value="meta">Meta Reversa</TabsTrigger>
              <TabsTrigger value="simulador">Simulador</TabsTrigger>
            </TabsList>

            <TabsContent value="mes" className="space-y-4">
              {baseInicial == null && (
                <Badge variant="outline" className="text-xs">
                  Base de alunos ativos não cadastrada — informe em Gestão Operacional ou no realizado do mês
                </Badge>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {kpis.map((k) => (
                  <div key={k.label} className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{k.valor}</p>
                  </div>
                ))}
              </div>
              <FunilForecastCard projecao={projecaoMes} realizado={autoMes} />
              <PremissasEditor
                key={`${unidadeId}-${ano}-${mes}-${premissaMes?.id ?? 'novo'}`}
                unidadeId={unidadeId}
                ano={ano}
                mes={mes}
                premissa={premissaMes}
                valores={valores}
                podeEditar={isAdmin}
              />
            </TabsContent>

            <TabsContent value="doze">
              <ProjecaoDozeMesesCard meses={doze} />
            </TabsContent>

            <TabsContent value="meta">
              <MetaReversaCard
                key={`${unidadeId}-${ano}-${mes}`}
                premissas={valores}
                baseInicial={baseInicial}
                metaSugerida={metaMes?.meta_alunos_ativos ?? baseAtual.data?.metaAlunos ?? null}
              />
            </TabsContent>

            <TabsContent value="simulador">
              <SimuladorCard key={`${unidadeId}-${ano}-${mes}`} premissas={valores} baseInicial={baseInicial} ano={ano} mes={mes} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
