import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Repeat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OpsStatusBadge } from '@/components/ops/OpsStatusBadge';
import { PRIORIDADE_DOT, PRIORIDADE_LABEL } from '@/components/ops/OpsTarefaItem';
import { AtividadeExecucaoPanel } from '@/components/ops/AtividadeExecucaoPanel';
import { NovaAtividadeDialog } from '@/components/operacional/NovaAtividadeDialog';
import { RotinaModal } from '@/components/rotinas/RotinaModal';
import { useRotinasData } from '@/hooks/useRotinasData';
import { useOpsGestao, TODAS_UNIDADES, type OpsGestaoTarefa } from '@/hooks/useOpsGestao';
import { useUnidade } from '@/contexts/UnidadeContext';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'atrasada', label: 'Atrasada' },
];

const PRIORIDADE_OPTIONS = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

function addDays(base: Date, days: number) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function labelData(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

function horaConclusao(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function GestaoDiaTab() {
  const [dia, setDia] = useState<Date>(() => new Date());
  const [fTipo, setFTipo] = useState('todos');
  const [fResponsavel, setFResponsavel] = useState('todos');
  const [fStatus, setFStatus] = useState('todos');
  const [fPrioridade, setFPrioridade] = useState('todas');
  const [aberta, setAberta] = useState<OpsGestaoTarefa | null>(null);
  const [novaAtividade, setNovaAtividade] = useState(false);
  const [novaRotina, setNovaRotina] = useState(false);
  const [salvandoRotina, setSalvandoRotina] = useState(false);

  const { unidadeAtual, unidadesPermitidas } = useUnidade();
  const multiUnidade = unidadesPermitidas.length > 1;
  const [unidadeAlvo, setUnidadeAlvo] = useState<string>(() => unidadeAtual?.id ?? '');
  const unidadeSel = unidadeAlvo || unidadeAtual?.id || '';

  const { tarefas, resumoPorUnidade, criticasAtrasadas, responsaveis, isLoading, isFetching, refetch } =
    useOpsGestao(dia, unidadeSel);
  const { createRotina, toggleExecucao } = useRotinasData();

  const filtradas = useMemo(
    () =>
      tarefas.filter((t) => {
        if (fTipo !== 'todos' && t.tipo !== fTipo) return false;
        if (fResponsavel !== 'todos') {
          if (fResponsavel === 'sem' ? !!t.responsavel_id : t.responsavel_id !== fResponsavel) return false;
        }
        if (fStatus !== 'todos' && t.status !== fStatus) return false;
        if (fPrioridade !== 'todas' && t.prioridade !== fPrioridade) return false;
        return true;
      }),
    [tarefas, fTipo, fResponsavel, fStatus, fPrioridade],
  );

  const hojeKey = new Date().toDateString();
  const unidadeNome =
    unidadeSel === TODAS_UNIDADES
      ? `${unidadesPermitidas.length} unidades`
      : unidadesPermitidas.find((u) => u.id === unidadeSel)?.nome || unidadeAtual?.nome;

  return (
    <div className="space-y-5">
      {/* Barra de data */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setDia((d) => addDays(d, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-[220px]">
          <p className="text-sm font-semibold capitalize">{labelData(dia)}</p>
          <p className="text-xs text-muted-foreground">
            {dia.toDateString() === hojeKey ? 'Hoje' : 'Outro dia'} · {filtradas.length} item(ns)
            {unidadeNome ? ` · ${unidadeNome}` : ''}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => setDia((d) => addDays(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {dia.toDateString() !== hojeKey && (
          <Button variant="ghost" size="sm" onClick={() => setDia(new Date())}>
            Voltar para hoje
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" className="gap-1.5" disabled={unidadeSel === TODAS_UNIDADES} onClick={() => setNovaAtividade(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nova atividade
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={unidadeSel === TODAS_UNIDADES} onClick={() => setNovaRotina(true)}>
            <Repeat className="h-3.5 w-3.5" />
            Nova rotina
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => refetch()}>
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>


      {/* ATENÇÃO — somente críticas atrasadas */}
      {criticasAtrasadas.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Atenção · {criticasAtrasadas.length} atividade(s) crítica(s) atrasada(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticasAtrasadas.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAberta(t)}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-card p-3 text-left text-sm hover:bg-accent/40"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{t.titulo}</span>
                <span className="text-xs text-muted-foreground">{t.unidade_nome}</span>
                <span className="text-xs text-muted-foreground">{t.responsavel_nome || 'Sem responsável'}</span>
                <span className="text-xs font-semibold tabular-nums text-destructive">
                  {(t.prazo || t.horario || '').slice(0, 5)}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Resumo por unidade */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {resumoPorUnidade.map((r) => (
          <Card key={r.unidade_id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{r.unidade_nome}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">{r.percentual}%</span>
                <span className="text-xs text-muted-foreground">
                  {r.concluidas}/{r.total} concluídas
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.percentual}%` }} />
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="secondary">{r.pendentes} pendentes</Badge>
                <Badge variant="secondary">{r.emAndamento} em andamento</Badge>
                {r.atrasadas > 0 && <Badge variant="destructive">{r.atrasadas} atrasadas</Badge>}
                {r.criticasAtrasadas > 0 && (
                  <Badge variant="destructive">{r.criticasAtrasadas} críticas</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {multiUnidade && (
          <Select value={unidadeSel} onValueChange={setUnidadeAlvo}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS_UNIDADES}>Todas as unidades</SelectItem>
              {unidadesPermitidas.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Atividades e rotinas</SelectItem>
            <SelectItem value="atividade">Somente atividades</SelectItem>
            <SelectItem value="rotina">Somente rotinas</SelectItem>
          </SelectContent>
        </Select>


        <Select value={fResponsavel} onValueChange={setFResponsavel}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            <SelectItem value="sem">Sem responsável</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fPrioridade} onValueChange={setFPrioridade}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as prioridades</SelectItem>
            {PRIORIDADE_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtradas.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum item para os filtros selecionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Hora</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-[110px]">Tipo</TableHead>
                    {unidadeSel === TODAS_UNIDADES && <TableHead>Unidade</TableHead>}
                    <TableHead>Responsável</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[110px]">Conclusão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((t) => (
                    <TableRow
                      key={`${t.tipo}-${t.id}`}
                      className="cursor-pointer"
                      onClick={() => setAberta(t)}
                    >
                      <TableCell className="tabular-nums">{(t.horario || '--:--').slice(0, 5)}</TableCell>
                      <TableCell className="max-w-[280px] truncate font-medium">{t.titulo}</TableCell>
                      <TableCell>
                        <Badge variant={t.tipo === 'rotina' ? 'outline' : 'secondary'} className="text-[11px]">
                          {t.tipo === 'rotina' ? 'Rotina' : 'Atividade'}
                        </Badge>
                      </TableCell>
                      {unidadeSel === TODAS_UNIDADES && (
                        <TableCell className="text-sm text-muted-foreground">{t.unidade_nome}</TableCell>
                      )}
                      <TableCell className="text-sm text-muted-foreground">
                        {t.responsavel_nome || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.setor || '—'}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span
                            className={cn('h-2 w-2 rounded-full', PRIORIDADE_DOT[t.prioridade] || PRIORIDADE_DOT.normal)}
                          />
                          {PRIORIDADE_LABEL[t.prioridade] || 'Normal'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <OpsStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="tabular-nums text-sm text-muted-foreground">
                        {horaConclusao(t.concluido_em)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!aberta} onOpenChange={(o) => { if (!o) setAberta(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {aberta && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{aberta.titulo}</DialogTitle>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{aberta.tipo === 'rotina' ? 'Rotina' : 'Atividade'}</span>
                  {aberta.horario && <span>{aberta.horario.slice(0, 5)}</span>}
                  <span>{aberta.unidade_nome}</span>
                  {aberta.responsavel_nome && <span>{aberta.responsavel_nome}</span>}
                  {aberta.setor && <span>{aberta.setor}</span>}
                  <span>Prioridade: {PRIORIDADE_LABEL[aberta.prioridade] || 'Normal'}</span>
                </div>
              </DialogHeader>
              {aberta.tipo === 'rotina' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <OpsStatusBadge status={aberta.status} />
                    {aberta.concluido_em && (
                      <span className="text-xs text-muted-foreground">
                        Concluída às {horaConclusao(aberta.concluido_em)}
                      </span>
                    )}
                  </div>
                  {dia.toDateString() === hojeKey ? (
                    <Button
                      size="sm"
                      variant={aberta.status === 'concluida' ? 'outline' : 'default'}
                      onClick={async () => {
                        await toggleExecucao(aberta.id, null, aberta.status !== 'concluida');
                        await refetch();
                        setAberta(null);
                      }}
                    >
                      {aberta.status === 'concluida' ? 'Reabrir rotina' : 'Marcar como concluída'}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Rotinas só podem ser concluídas no dia de hoje.
                    </p>
                  )}
                </div>
              ) : (
                <AtividadeExecucaoPanel
                  atividadeId={aberta.id}
                  unidadeId={aberta.unidade_id}
                  data={dia}
                  horario={aberta.horario}
                  prazo={aberta.prazo}
                  exigeEvidencia={aberta.exige_evidencia}
                  exigeConfirmacao={false}
                  instrucao={null}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <NovaAtividadeDialog
        open={novaAtividade}
        onOpenChange={(v) => {
          setNovaAtividade(v);
          if (!v) refetch();
        }}
        diaSemana={dia.getDay()}
        unidadeId={unidadeSel === TODAS_UNIDADES ? undefined : unidadeSel}
      />

      <RotinaModal
        open={novaRotina}
        onOpenChange={setNovaRotina}
        saving={salvandoRotina}
        onSave={async (data, atividades) => {
          setSalvandoRotina(true);
          const created = await createRotina(data, atividades);
          setSalvandoRotina(false);
          if (created) {
            setNovaRotina(false);
            await refetch();
            return true;
          }
          return false;
        }}
      />
    </div>
  );

}
