import { useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Clock, Calendar, Zap, MessageSquare, Pencil, History, X } from 'lucide-react';
import { useCronJobs, type CronJob } from '@/hooks/useCronJobs';
import { getCanal, humanizeSchedule, getJobLabel, getJobDescription, DIAS_SEMANA } from '@/lib/cronUtils';
import { useCronogramaAdminData, type CronogramaAtividadeAdmin } from '@/hooks/useCronogramaAdmin';
import { useUnidadeUsers } from '@/hooks/useUnidadeUsers';
import { AtividadesPorTipo } from '@/components/cronograma-admin/AtividadesPorTipo';
import { BulkEditDialog, type BulkField } from '@/components/cronograma-admin/BulkEditDialog';
import { HistoricoDialog } from '@/components/cronograma-admin/HistoricoDialog';

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

function EditAtividadeDialog({ atv, open, onOpenChange, onSave }: { atv: CronogramaAtividadeAdmin | null; open: boolean; onOpenChange: (v: boolean) => void; onSave: (patch: { horario: string | null; turno: string | null; dias: number[] }) => void }) {
  const [horario, setHorario] = useState(atv?.horario?.slice(0, 5) || '');
  const [dias, setDias] = useState<number[]>(atv?.dia_semana != null ? [atv.dia_semana] : []);
  const [turno, setTurno] = useState<string>(atv?.turno || '');

  const toggleDia = (v: number) => setDias((d) => d.includes(v) ? d.filter(x => x !== v) : [...d, v].sort((a, b) => a - b));

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v && atv) { setHorario(atv.horario?.slice(0, 5) || ''); setDias(atv.dia_semana != null ? [atv.dia_semana] : []); setTurno(atv.turno || ''); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar — {atv?.titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Horário</label>
            <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Dias da semana</label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDias([1,2,3,4,5])}>Seg–Sex</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDias([0,6])}>Fim de semana</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDias([0,1,2,3,4,5,6])}>Todos</Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDias([])}>Limpar</Button>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {DIAS_SEMANA.map((d) => (
                <label key={d.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={dias.includes(d.value)} onCheckedChange={() => toggleDia(d.value)} />
                  {d.label}
                </label>
              ))}
            </div>
            {dias.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Serão criadas cópias para os demais dias selecionados; o registro original manterá o primeiro dia.
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Turno</label>
            <Input value={turno} onChange={e => setTurno(e.target.value.toUpperCase())} placeholder="Ex: TURNO 1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={dias.length === 0}
            onClick={() => onSave({ horario: horario ? `${horario}:00` : null, turno: turno || null, dias })}
          >Salvar</Button>
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
  const { users } = useUnidadeUsers();

  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [editingAtv, setEditingAtv] = useState<CronogramaAtividadeAdmin | null>(null);

  const [viewMode, setViewMode] = useState<'tipo' | 'dia'>('tipo');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState<BulkField | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  const opJobs = jobs.filter((j) => getCanal(j.jobname) === 'operacional');
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

  const responsaveisOpts = useMemo(() => users.map(u => ({ id: u.id, label: u.name })), [users]);

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
              <Zap className="w-4 h-4" /> D-API Operacional
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
                    onEditSingle={setEditingAtv}
                    onToggleAtivo={(a, v) => updateSingle.mutate({ id: a.id, patch: { ativo: v } })}
                    onOpenBulk={setBulkField}
                  />
                ) : (
                  <AtividadesPorDia
                    atividades={atividades}
                    onToggle={(a, v) => updateSingle.mutate({ id: a.id, patch: { ativo: v } })}
                    onEdit={setEditingAtv}
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

      <EditAtividadeDialog
        atv={editingAtv}
        open={!!editingAtv}
        onOpenChange={(v) => !v && setEditingAtv(null)}
        onSave={(patch) => {
          if (!editingAtv) return;
          updateSingle.mutate(
            { id: editingAtv.id, patch },
            { onSuccess: () => setEditingAtv(null) }
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
    </Layout>
  );
}
