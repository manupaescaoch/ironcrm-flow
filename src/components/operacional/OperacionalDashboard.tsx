import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Loader2,
  Scale,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/ui/kpi-card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DISTRIBUICAO_LABEL,
  NOTA_CLASSE_COLOR,
  NOTA_CLASSE_LABEL,
  PeriodoPreset,
  classificarNota,
  parseISODate,
  presetRange,
  variacao,
} from '@/lib/operacionalDashboard';
import { OperacionalFiltros, useOperacionalDashboard } from '@/hooks/useOperacionalDashboard';
import { OperacionalDashboardFiltros } from './OperacionalDashboardFiltros';
import { AtendimentosTreinadorCard } from './AtendimentosTreinadorCard';
import { EvolucaoIndicadoresCard } from './EvolucaoIndicadoresCard';
import { ComparativoUnidadesCard } from './ComparativoUnidadesCard';
import { IndiceOperacionalCard } from './IndiceOperacionalCard';
import { PendenciasAlertasCard } from './PendenciasAlertasCard';
import { InsightsCard } from './InsightsCard';
import { CronogramaDashboard } from '@/components/cronograma/CronogramaDashboard';
import { FormularioOrigem, FormularioOrigemDialog } from './FormularioOrigemDialog';

interface DrillItem {
  texto: string;
  origem?: FormularioOrigem;
}

const txt = (itens: string[]): DrillItem[] => itens.map((texto) => ({ texto }));

const fmtNum = (v: number | null, dec = 1) => (v === null || v === undefined ? 'Sem registro' : v.toFixed(dec).replace('.', ','));

export function OperacionalDashboard() {
  const [preset, setPreset] = useState<PeriodoPreset>('7d');
  const inicial = presetRange('7d');
  const [filtros, setFiltros] = useState<OperacionalFiltros>({
    unidade: 'all',
    turno: 'all',
    funcao: 'all',
    funcionario: 'all',
    start: inicial.start,
    end: inicial.end,
  });
  const [drill, setDrill] = useState<{ titulo: string; itens: DrillItem[] } | null>(null);
  const [origem, setOrigem] = useState<FormularioOrigem | null>(null);

  const { data, isLoading, error } = useOperacionalDashboard(filtros);

  const mediaEquipe = data?.produtividade.mediaTreinador ?? null;

  const registrosQualidade = useMemo(() => data?.registros ?? null, [data]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Não foi possível carregar os indicadores operacionais. {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <OperacionalDashboardFiltros
        filtros={filtros}
        onChange={setFiltros}
        preset={preset}
        onPreset={setPreset}
        unidades={data?.unidadesDisponiveis ?? []}
        funcionarios={data?.funcionariosDisponiveis ?? []}
      />

      {isLoading || !data ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : !data.temDados ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum formulário operacional enviado no período selecionado.</p>
            <p className="text-xs text-muted-foreground">Ajuste o período ou os filtros para visualizar os indicadores.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Alertas críticos */}
          {data.alertas.length > 0 && (
            <Card className="border-amber-300/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  Alertas automáticos ({data.alertas.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2 overflow-x-auto pb-2">
                {data.alertas.slice(0, 8).map((a) => (
                  <div key={a.key} className="min-w-[240px] shrink-0 rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">{a.categoria}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(parseISODate(a.data), 'dd/MM', { locale: ptBR })} · {a.unidade}
                      </span>
                    </div>
                    <p className="mt-1 text-xs line-clamp-2" title={a.descricao}>{a.descricao}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 1ª linha — produtividade */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard
              title="Total de atendimentos"
              value={data.produtividade.totalAtendimentos}
              icon={Activity}
              variant="compact"
              variacao={data.produtividade.totalAtendimentosVar}
              subtitle={`Anterior: ${data.produtividade.totalAtendimentosAnt}`}
              onClick={() =>
                setDrill({
                  titulo: 'Atendimentos por registro',
                  itens: data.porTreinador.map((t) => `${t.treinador}: ${t.total} atendimentos (média ${t.mediaDiaria.toFixed(1)}/dia)`),
                })
              }
            />
            <KPICard
              title="Média por treinador"
              value={fmtNum(data.produtividade.mediaTreinador)}
              icon={Users}
              variant="compact"
              variacao={data.produtividade.mediaTreinadorVar}
              subtitle={`${data.produtividade.treinadoresAtivos} treinadores com atendimento`}
            />
            <KPICard
              title="Experimentais"
              value={data.produtividade.experimentais}
              icon={UserCheck}
              variant="compact"
              variacao={data.produtividade.experimentaisVar}
              subtitle={`Anterior: ${data.produtividade.experimentaisAnt}`}
            />
            <KPICard
              title="Taxa de preenchimento"
              value={data.produtividade.taxaPreenchimento === null ? 'Sem registro' : `${data.produtividade.taxaPreenchimento.toFixed(0)}%`}
              icon={ClipboardCheck}
              variant="compact"
              variacao={data.produtividade.taxaPreenchimentoVar}
              subtitle={`${data.turnos.encerrados} de ${data.turnos.previstos} turnos`}
            />
            <KPICard
              title="Ocorrências abertas"
              value={data.ocorrenciasAbertas}
              icon={AlertTriangle}
              variant="compact"
              color={data.ocorrenciasAbertas > 0 ? 'amber' : 'green'}
              subtitle={`${data.turnos.pendentes} turno(s) pendente(s)`}
            />
            <KPICard
              title="Padrão EVO mantido"
              value={data.padraoEvo.percentual === null ? 'Sem registro' : `${data.padraoEvo.percentual.toFixed(0)}%`}
              icon={ShieldCheck}
              variant="compact"
              variacao={variacao(data.padraoEvo.percentual, data.padraoEvo.percentualAnterior)}
              subtitle={`${data.padraoEvo.fora.length} turno(s) fora do padrão`}
              onClick={() =>
                setDrill({
                  titulo: 'Turnos que não mantiveram o Padrão EVO',
                  itens: data.padraoEvo.fora.map(
                    (f) => `${format(parseISODate(f.data), 'dd/MM')} · ${f.unidade} · ${f.responsavel} — ${f.justificativa || 'sem justificativa registrada'}`,
                  ),
                })
              }
            />
          </div>

          {data.produtividade.pendentesRevisao > 0 && (
            <p className="text-xs text-amber-600">
              {data.produtividade.pendentesRevisao} formulário(s) com atendimentos em texto livre não interpretados — atendimentos pendentes de revisão.
            </p>
          )}

          {/* Distribuição dos atendimentos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary" />
                Distribuição dos atendimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data.distribuicao ? (
                <p className="text-sm text-muted-foreground">Sem atendimentos registrados para avaliar a distribuição.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        data.distribuicao.classe === 'equilibrada'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : data.distribuicao.classe === 'atencao'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      }
                      variant="outline"
                    >
                      {DISTRIBUICAO_LABEL[data.distribuicao.classe]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Diferença de {data.distribuicao.amplitude} atendimento(s) entre o maior e o menor
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-md border p-2">
                      <p className="text-muted-foreground">Maior individual</p>
                      <p className="font-semibold">{data.distribuicao.maior?.treinador} · {data.distribuicao.maior?.quantidade}</p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="text-muted-foreground">Menor individual</p>
                      <p className="font-semibold">{data.distribuicao.menor?.treinador} · {data.distribuicao.menor?.quantidade}</p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="text-muted-foreground">Média</p>
                      <p className="font-semibold">{fmtNum(data.distribuicao.media)}</p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="text-muted-foreground">Treinadores que atuaram</p>
                      <p className="font-semibold">{data.distribuicao.totalTreinadores}</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-muted-foreground mb-1">Acima da média</p>
                      <p>{data.distribuicao.acimaMedia.join(', ') || '—'}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-muted-foreground mb-1">Abaixo da média</p>
                      <p>{data.distribuicao.abaixoMedia.join(', ') || '—'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2ª linha — qualidade operacional */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Qualidade operacional (notas de 1 a 5)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {data.qualidade.map((q) => {
                const classe = classificarNota(q.media);
                const varc = variacao(q.media, q.mediaAnterior);
                return (
                  <Card
                    key={q.key}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() =>
                      setDrill({
                        titulo: `${q.label} — registros do período`,
                        itens:
                          registrosQualidade?.coordenador.map(
                            (r) => `${format(new Date(r.created_at), 'dd/MM')} · ${r.unidade} · ${r.turno} · ${r.nome}`,
                          ) ?? [],
                      })
                    }
                  >
                    <CardContent className="p-3 space-y-1">
                      <p className="text-xs text-muted-foreground truncate" title={q.label}>{q.label}</p>
                      <div className="flex items-end gap-2">
                        <span className={`text-2xl font-bold ${classe ? NOTA_CLASSE_COLOR[classe] : ''}`}>{fmtNum(q.media, 2)}</span>
                        {classe && <span className="text-[10px] mb-1">{NOTA_CLASSE_LABEL[classe]}</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground space-y-0.5">
                        <p>Anterior: {fmtNum(q.mediaAnterior, 2)} {varc ? `(${varc.percentual >= 0 ? '+' : ''}${varc.percentual.toFixed(0)}%)` : ''}</p>
                        <p>{q.avaliacoes} avaliação(ões) · {q.abaixoDe4} abaixo de 4</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* 3ª linha */}
          <div className="grid lg:grid-cols-2 gap-4">
            <AtendimentosTreinadorCard dados={data.porTreinador} mediaEquipe={mediaEquipe} />
            <EvolucaoIndicadoresCard buildSerie={data.buildSerie} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ComparativoUnidadesCard linhas={data.comparativo} />
            <IndiceOperacionalCard
              indice={data.indice.indice}
              indiceAnterior={data.indiceAnterior}
              componentes={data.indice.componentes}
              pesoUtilizado={data.indice.pesoUtilizado}
              porUnidade={data.comparativo.map((c) => ({ unidade: c.unidade, indice: c.indice }))}
            />
          </div>

          {/* Indicadores de equipe */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Indicadores de equipe</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <KPICard
                title="Taxa de presença"
                value={data.equipe.taxaPresenca === null ? 'Sem registro' : `${data.equipe.taxaPresenca.toFixed(0)}%`}
                icon={CalendarCheck}
                variant="compact"
              />
              <KPICard title="Faltas" value={data.equipe.faltas} icon={AlertTriangle} variant="compact" color={data.equipe.faltas > 0 ? 'amber' : 'green'}
                subtitle={`${data.equipe.justificadas} justificadas · ${data.equipe.naoJustificadas} não justificadas`}
                onClick={() => setDrill({ titulo: 'Faltas e atrasos registrados', itens: data.equipe.detalhesFaltas })}
              />
              <KPICard title="Atrasos" value={data.equipe.atrasos} icon={AlertTriangle} variant="compact" />
              <KPICard title="Feedbacks corretivos" value={data.equipe.feedbacksCorretivos} icon={ClipboardList} variant="compact" />
              <KPICard title="Destaques positivos" value={data.equipe.destaques} icon={Sparkles} variant="compact" color="green" />
              <KPICard title="Solicitações de suporte" value={data.equipe.suportes} icon={BadgeCheck} variant="compact" />
              <KPICard title="Clima da equipe" value={fmtNum(data.equipe.climaEquipe, 2)} icon={Users} variant="compact" />
            </div>
          </div>

          {/* 4ª linha */}
          <PendenciasAlertasCard pendencias={data.pendencias} />
          <InsightsCard insights={data.insights} />

          <Accordion type="single" collapsible>
            <AccordionItem value="cronograma">
              <AccordionTrigger className="text-sm">Cronograma e rotinas (envios e execuções)</AccordionTrigger>
              <AccordionContent>
                <CronogramaDashboard />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{drill?.titulo}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            <div className="space-y-1">
              {(drill?.itens.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Sem registros para exibir.</p>
              ) : (
                drill?.itens.map((i, idx) => (
                  <p key={idx} className="rounded-md border p-2 text-xs">{i}</p>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
