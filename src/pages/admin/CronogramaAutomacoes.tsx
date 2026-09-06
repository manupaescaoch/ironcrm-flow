import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, Calendar, Zap, MessageSquare, Pencil, History, X, MessageCircle, FileText, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCronJobs, type CronJob } from '@/hooks/useCronJobs';
import { getCanal, humanizeSchedule, getJobLabel, getJobDescription, DIAS_SEMANA } from '@/lib/cronUtils';
import { useCronogramaAdminData, type CronogramaAtividadeAdmin } from '@/hooks/useCronogramaAdmin';
import { AtividadesPorTipo } from '@/components/cronograma-admin/AtividadesPorTipo';
import type { GrupoConjunto } from '@/components/cronograma-admin/AtividadesPorTipo';
import { BulkEditDialog, type BulkField } from '@/components/cronograma-admin/BulkEditDialog';
import { HistoricoDialog } from '@/components/cronograma-admin/HistoricoDialog';
import { NewAtividadeDialog } from '@/components/cronograma-admin/NewAtividadeDialog';
import { DIAS_LABEL_SHORT, type TipoDisplay } from '@/lib/cronogramaTipos';
import { NOME_TOKEN, aplicarPlaceholders, contemNomeToken, inserirToken } from '@/lib/mensagemPlaceholder';


function atvToGrupo(a: CronogramaAtividadeAdmin): GrupoConjunto {
  return {
    key: a.id,
    titulo: a.titulo,
    horario: a.horario,
    responsavel_id: a.responsavel_id,
    responsavel_nome: a.cronograma_funcionarios?.nome || '—',
    unidade_id: a.unidade_id,
    unidade_nome: a.unidades?.nome || '—',
    dias: a.dia_semana != null ? [a.dia_semana] : [],
    diasAtivos: a.ativo && a.dia_semana != null ? [a.dia_semana] : [],
    ids: [a.id],
    ativoAll: a.ativo,
    ativoAny: a.ativo,
    itens: [a],
  };
}


function EditScheduleDialog({ job, open, onOpenChange, onSave }: { job: CronJob | null; open: boolean; onOpenChange: (v: boolean) => void; onSave: (schedule: string) => void }) {
  const [value, setValue] = useState(job?.schedule || '');
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v && job) setValue(job.schedule); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar horário — {job ? getJobLabel(job.jobname) : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Expressão cron (UTC)</label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="min hora dia mes dow" />
          <p className="text-xs text-muted-foreground">
            Ex: <code>0 12 * * 1-5</code> = todo dia útil às 12h UTC (9h BRT).
          </p>
          {value && <p className="text-xs">Preview: <b>{humanizeSchedule(value)}</b></p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave(value)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditGrupoPayload {
  ids: string[];
  patch: {
    horario: string | null;
    responsavel_id: string | null;
    mensagem: string | null;
    formulario_id: string | null;
  };
  dias: number[];
}

function EditGrupoDialog({
  grupo,
  open,
  onOpenChange,
  onSave,
  onDelete,
  loading,
}: {
  grupo: GrupoConjunto | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (p: EditGrupoPayload) => void;
  onDelete: (ids: string[]) => void;
  loading: boolean;
}) {
  const first = grupo?.itens[0];
  const [horario, setHorario] = useState('');
  const [dias, setDias] = useState<number[]>([]);
  const [respId, setRespId] = useState<string>('');
  const [modo, setModo] = useState<'mensagem' | 'formulario'>('mensagem');
  const [mensagem, setMensagem] = useState('');
  const [formularioId, setFormularioId] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const grupoKey = grupo?.key ?? null;

  useEffect(() => {
    if (!open || !grupo || !first) return;
    setHorario(grupo.horario?.slice(0, 5) || '');
    setDias(Array.from(new Set(grupo.diasAtivos)).sort((a, b) => a - b));
    setRespId(grupo.responsavel_id || '');
    const hasForm = !!first.formulario_id;
    setModo(hasForm ? 'formulario' : 'mensagem');
    setMensagem(first.mensagem || '');
    setFormularioId(first.formulario_id || '');
    // Reinicializa apenas ao abrir ou ao trocar a atividade editada (evita o cursor
    // voltar para o fim do texto quando o componente pai re-renderiza).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, grupoKey]);


  const { data: funcionarios = [] } = useQuery({
    queryKey: ['cronograma-funcionarios-full', grupo?.unidade_id],
    enabled: open && !!grupo?.unidade_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cronograma_funcionarios_full' as any, {
        p_unidade_id: grupo!.unidade_id,
      });
      if (error) throw error;
      return ((data as any[]) || []).filter((f) => f.ativo) as {
        id: string;
        nome: string;
        telefone: string | null;
        cargo: string | null;
      }[];
    },
  });

  const { data: formularios = [] } = useQuery({
    queryKey: ['formularios-por-unidade', grupo?.unidade_id],
    enabled: open && !!grupo?.unidade_id && modo === 'formulario',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formularios')
        .select('id, titulo')
        .eq('unidade_id', grupo!.unidade_id)
        .eq('ativo', true)
        .order('titulo');
      if (error) throw error;
      return data as { id: string; titulo: string }[];
    },
  });

  const toggleDia = (v: number) =>
    setDias((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v].sort((a, b) => a - b)));

  const respSelecionado = funcionarios.find((f) => f.id === respId);

  if (!grupo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Editar Atividade</DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            {grupo.titulo} · {grupo.unidade_nome}
          </p>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto scrollbar-visible pr-2">

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Responsável</label>
            <Select value={respId} onValueChange={setRespId}>
              <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
              <SelectContent>
                {funcionarios.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}{f.telefone ? ` — ${f.telefone}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {respSelecionado?.telefone && (
              <div className="flex items-center gap-2 text-xs bg-muted/40 rounded-md px-3 py-2">
                <MessageCircle className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold">{respSelecionado.nome}</span>
                <span className="text-muted-foreground">— WhatsApp: {respSelecionado.telefone}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Horário</label>
            <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Dias da semana</label>
            <div className="grid grid-cols-7 gap-1.5">
              {DIAS_LABEL_SHORT.map((lbl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDia(idx)}
                  className={
                    'py-2 rounded-md border text-xs font-medium transition-colors ' +
                    (dias.includes(idx)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-input')
                  }
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button type="button" size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDias([1, 2, 3, 4, 5])}>Seg–Sex</Button>
              <Button type="button" size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDias([0, 6])}>Fim de semana</Button>
              <Button type="button" size="sm" variant="outline" className="h-6 text-xs" onClick={() => setDias([0, 1, 2, 3, 4, 5, 6])}>Todos</Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setDias([])}>Limpar</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {dias.length === 0
                ? 'Nenhum dia selecionado'
                : `Apenas: ${dias.map((d) => DIAS_LABEL_SHORT[d]).join(', ')}`}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ação WhatsApp</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={modo === 'formulario' ? 'default' : 'outline'}
                onClick={() => setModo('formulario')}
                className="justify-start"
              >
                <FileText className="w-4 h-4 mr-2" /> Vincular Formulário
              </Button>
              <Button
                type="button"
                variant={modo === 'mensagem' ? 'default' : 'outline'}
                onClick={() => setModo('mensagem')}
                className="justify-start"
              >
                <MessageCircle className="w-4 h-4 mr-2" /> Escrever Mensagem
              </Button>
            </div>
            {modo === 'formulario' ? (
              <Select value={formularioId} onValueChange={setFormularioId}>
                <SelectTrigger><SelectValue placeholder="Selecionar formulário" /></SelectTrigger>
                <SelectContent>
                  {formularios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => inserirToken(textareaRef.current, mensagem, NOME_TOKEN, setMensagem)}
                  >
                    + Inserir nome
                  </Button>
                  <span className="text-xs text-muted-foreground normal-case">
                    [NOME] é trocado pelo primeiro nome do responsável no envio.
                  </span>
                </div>
                <Textarea
                  ref={textareaRef}
                  preserveCase
                  className="!normal-case"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Mensagem enviada via WhatsApp..."
                  rows={4}
                />
                {contemNomeToken(mensagem) && (
                  respSelecionado ? (
                    <div className="text-xs bg-muted/40 rounded-md px-3 py-2 whitespace-pre-wrap normal-case">
                      <span className="font-semibold">Prévia: </span>
                      {aplicarPlaceholders(mensagem, respSelecionado.nome)}
                    </div>
                  ) : (
                    <div className="text-xs text-destructive normal-case">
                      Selecione um responsável para usar a variável [NOME].
                    </div>
                  )
                )}
              </div>
            )}


          </div>
        </div>

        <DialogFooter className="gap-2 shrink-0 border-t pt-3 mt-1">
          <Button
            className="flex-1"
            disabled={loading || dias.length === 0 || !respId}
            onClick={() =>
              onSave({
                ids: grupo.ids,
                patch: {
                  horario: horario ? `${horario}:00` : null,
                  responsavel_id: respId || null,
                  mensagem: modo === 'mensagem' ? (mensagem || null) : null,
                  formulario_id: modo === 'formulario' ? (formularioId || null) : null,
                },
                dias,
              })
            }
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Alterações
          </Button>
          <Button
            variant="destructive"
            size="icon"
            disabled={loading}
            onClick={() => {
              if (confirm(`Excluir ${grupo.ids.length} envio(s) deste conjunto?`)) onDelete(grupo.ids);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobsTable({ jobs, onToggle, onEdit }: { jobs: CronJob[]; onToggle: (j: CronJob, v: boolean) => void; onEdit: (j: CronJob) => void }) {
  if (jobs.length === 0) return <p className="text-sm text-muted-foreground">Nenhum job neste canal.</p>;
  return (
    <div className="space-y-2">
      {jobs.map((j) => (
        <div key={j.jobid} className="flex items-center justify-between p-3 rounded-md border gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">{getJobLabel(j.jobname)}</p>
              <Badge variant={j.active ? 'default' : 'secondary'} className="text-xs">
                {j.active ? 'Ativo' : 'Pausado'}
              </Badge>
            </div>
            {getJobDescription(j.jobname) && (
              <p className="text-xs text-muted-foreground mt-0.5">{getJobDescription(j.jobname)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {humanizeSchedule(j.schedule)} · <code className="text-[10px] opacity-70">{j.jobname}</code>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch checked={j.active} onCheckedChange={(v) => onToggle(j, v)} />
            <Button size="sm" variant="outline" onClick={() => onEdit(j)}>
              <Pencil className="w-3 h-3 mr-1" /> Editar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Vista legada por dia da semana
function AtividadesPorDia({ atividades, onToggle, onEdit }: { atividades: CronogramaAtividadeAdmin[]; onToggle: (a: CronogramaAtividadeAdmin, v: boolean) => void; onEdit: (a: CronogramaAtividadeAdmin) => void }) {
  const porDia = DIAS_SEMANA.map((d) => ({
    ...d,
    itens: atividades.filter((a) => (a.dia_semana ?? -1) === d.value),
  }));
  return (
    <div className="space-y-4">
      {porDia.map((d) => (
        <div key={d.value}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{d.label} ({d.itens.length})</h4>
          {d.itens.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem atividades</p>
          ) : (
            <div className="space-y-1.5">
              {d.itens.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-md border gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{a.horario?.slice(0, 5) || '—'}</span>
                      <span className="text-sm">{a.titulo}</span>
                      {!a.ativo && <Badge variant="secondary" className="text-xs">Pausada</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.cronograma_funcionarios?.nome || '—'} · {a.unidades?.nome || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={a.ativo} onCheckedChange={(v) => onToggle(a, v)} />
                    <Button size="sm" variant="outline" onClick={() => onEdit(a)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminCronogramaAutomacoes() {
  const { jobs, isLoading: loadingJobs, toggleJob, updateSchedule } = useCronJobs();
  const { data: atividades = [], isLoading: loadingAtv, bulkUpdate, updateSingle } = useCronogramaAdminData();

  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [editingGrupo, setEditingGrupo] = useState<GrupoConjunto | null>(null);
  const [creatingTipo, setCreatingTipo] = useState<TipoDisplay | null>(null);

  const [viewMode, setViewMode] = useState<'tipo' | 'dia'>('tipo');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState<BulkField | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  const opJobs = jobs.filter((j) => getCanal(j.jobname) === 'operacional');
  const op2Jobs = jobs.filter((j) => getCanal(j.jobname) === 'operacional2');
  const comJobs = jobs.filter((j) => getCanal(j.jobname) === 'comercial');
  const outros = jobs.filter((j) => getCanal(j.jobname) === 'outro');

  const stats = useMemo(() => {
    const total = atividades.length;
    const ativas = atividades.filter(a => a.ativo).length;
    const tipos = new Set(atividades.map(a => a.tipo_atividade || 'SEM TIPO')).size;
    return { total, ativas, pausadas: total - ativas, tipos };
  }, [atividades]);

  const selectedItems = useMemo(() => atividades.filter(a => selected.has(a.id)), [atividades, selected]);

  const unidadesOpts = useMemo(() =>
    Array.from(new Map(atividades.map(a => [a.unidade_id, a.unidades?.nome || '—'])).entries())
      .map(([id, label]) => ({ id, label: label as string })),
    [atividades]
  );

  const responsaveisOpts = useMemo(() => {
    const map = new Map<string, string>();
    atividades.forEach(a => {
      if (a.responsavel_id && a.cronograma_funcionarios?.nome) {
        map.set(a.responsavel_id, a.cronograma_funcionarios.nome);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [atividades]);

  if (loadingJobs || loadingAtv) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const handleBulkSubmit = async (payload: any) => {
    await bulkUpdate.mutateAsync({ ids: Array.from(selected), ...payload });
    setBulkField(null);
    setSelected(new Set());
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 pb-24">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Cronograma de Automações</h1>
              <p className="text-sm text-muted-foreground">Jobs agendados e cronograma operacional por canal (D-API × Z-API)</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setHistoricoOpen(true)}>
            <History className="w-4 h-4 mr-1.5" /> Histórico
          </Button>
        </div>

        <Tabs defaultValue="operacional">
          <TabsList>
            <TabsTrigger value="operacional" className="gap-1.5">
              <Zap className="w-4 h-4" /> D-API MANU
            </TabsTrigger>
            <TabsTrigger value="comercial" className="gap-1.5">
              <MessageSquare className="w-4 h-4" /> Z-API Comercial
            </TabsTrigger>
            {outros.length > 0 && (
              <TabsTrigger value="outros">Outros ({outros.length})</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="operacional" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Jobs automáticos (pg_cron) — {opJobs.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <JobsTable
                  jobs={opJobs}
                  onToggle={(j, v) => toggleJob.mutate({ jobid: j.jobid, active: v })}
                  onEdit={setEditingJob}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-base">Cronograma de atividades</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      <b>{stats.total}</b> automações cadastradas · <span className="text-green-600">{stats.ativas} ativas</span> · <span className="text-amber-600">{stats.pausadas} pausadas</span> · {stats.tipos} tipos de atividade
                    </p>
                  </div>
                  <Tabs value={viewMode} onValueChange={(v: any) => { setViewMode(v); setSelected(new Set()); }}>
                    <TabsList className="h-8">
                      <TabsTrigger value="tipo" className="text-xs h-6">Por atividade</TabsTrigger>
                      <TabsTrigger value="dia" className="text-xs h-6">Por dia da semana</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === 'tipo' ? (
                  <AtividadesPorTipo
                    atividades={atividades}
                    selected={selected}
                    setSelected={setSelected}
                    onEditGrupo={setEditingGrupo}
                    onToggleGrupo={(g, v) =>
                      bulkUpdate.mutate({ ids: g.ids, patch: { ativo: v } })
                    }
                    onDeleteGrupo={(g) =>
                      bulkUpdate.mutate({ ids: g.ids, delete: true })
                    }
                    onNewInTipo={setCreatingTipo}
                  />
                ) : (
                  <AtividadesPorDia
                    atividades={atividades}
                    onToggle={(a, v) => updateSingle.mutate({ id: a.id, patch: { ativo: v } })}
                    onEdit={(a) => setEditingGrupo(atvToGrupo(a))}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comercial" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Jobs automáticos (pg_cron) — {comJobs.length}</CardTitle>
                <p className="text-xs text-muted-foreground">Disparados no chip comercial (Z-API).</p>
              </CardHeader>
              <CardContent>
                <JobsTable
                  jobs={comJobs}
                  onToggle={(j, v) => toggleJob.mutate({ jobid: j.jobid, active: v })}
                  onEdit={setEditingJob}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {outros.length > 0 && (
            <TabsContent value="outros" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Jobs não classificados</CardTitle>
                </CardHeader>
                <CardContent>
                  <JobsTable
                    jobs={outros}
                    onToggle={(j, v) => toggleJob.mutate({ jobid: j.jobid, active: v })}
                    onEdit={setEditingJob}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Sticky bulk actions bar */}
      {selected.size > 0 && viewMode === 'tipo' && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur z-40 shadow-lg">
          <div className="max-w-full px-4 py-2.5 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium mr-2">{selected.size} automações selecionadas</span>
            <Button size="sm" variant="outline" onClick={() => setBulkField('ativar')}>Ativar</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkField('pausar')}>Pausar</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkField('horario')}>Horário</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkField('dias')}>Dias</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkField('responsavel_id')}>Responsável</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkField('unidade_id')}>Unidade</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkField('turno')}>Turno</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkField('mensagem')}>Mensagem</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkField('duplicar')}>Duplicar</Button>
            <Button size="sm" variant="destructive" onClick={() => setBulkField('excluir')}>Excluir</Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          </div>
        </div>
      )}

      <EditScheduleDialog
        job={editingJob}
        open={!!editingJob}
        onOpenChange={(v) => !v && setEditingJob(null)}
        onSave={(schedule) => {
          if (!editingJob) return;
          updateSchedule.mutate(
            { jobid: editingJob.jobid, schedule },
            { onSuccess: () => setEditingJob(null) }
          );
        }}
      />

      <EditGrupoDialog
        grupo={editingGrupo}
        open={!!editingGrupo}
        onOpenChange={(v) => !v && setEditingGrupo(null)}
        loading={bulkUpdate.isPending || updateSingle.isPending}
        onDelete={(ids) => {
          bulkUpdate.mutate(
            { ids, delete: true },
            { onSuccess: () => setEditingGrupo(null) }
          );
        }}
        onSave={({ ids, patch, dias }) => {
          bulkUpdate.mutate(
            { ids, patch, replace_dias: dias },
            { onSuccess: () => setEditingGrupo(null) }
          );
        }}
      />

      <BulkEditDialog
        open={!!bulkField}
        onOpenChange={(v) => !v && setBulkField(null)}
        field={bulkField}
        selected={selectedItems}
        unidadesOptions={unidadesOpts}
        responsaveisOptions={responsaveisOpts}
        loading={bulkUpdate.isPending}
        onSubmit={handleBulkSubmit}
      />

      <HistoricoDialog open={historicoOpen} onOpenChange={setHistoricoOpen} />

      <NewAtividadeDialog
        tipo={creatingTipo}
        open={!!creatingTipo}
        onOpenChange={(v) => !v && setCreatingTipo(null)}
      />
    </Layout>
  );
}
