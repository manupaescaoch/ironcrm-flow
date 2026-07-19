import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, Calendar, Zap, MessageSquare, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCronJobs, type CronJob } from '@/hooks/useCronJobs';
import { getCanal, humanizeSchedule, getJobLabel, getJobDescription, DIAS_SEMANA } from '@/lib/cronUtils';
import { toast } from '@/hooks/use-toast';

interface AtividadeRow {
  id: string;
  titulo: string;
  horario: string | null;
  dia_semana: number | null;
  ativo: boolean;
  unidade_id: string;
  unidades?: { nome: string } | null;
  cronograma_funcionarios?: { nome: string } | null;
}

function useAllAtividades() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-all-cronograma-atividades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cronograma_atividades')
        .select('id, titulo, horario, dia_semana, ativo, unidade_id, unidades(nome), cronograma_funcionarios(nome)')
        .order('dia_semana', { ascending: true })
        .order('horario', { ascending: true });
      if (error) throw error;
      return (data || []) as AtividadeRow[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<AtividadeRow, 'ativo' | 'horario' | 'dia_semana'>> }) => {
      const { error } = await supabase.from('cronograma_atividades').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-all-cronograma-atividades'] });
      toast({ title: 'Atividade atualizada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return { atividades: data, isLoading, update };
}

function EditScheduleDialog({ job, open, onOpenChange, onSave }: { job: CronJob | null; open: boolean; onOpenChange: (v: boolean) => void; onSave: (schedule: string) => void }) {
  const [value, setValue] = useState(job?.schedule || '');
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v && job) setValue(job.schedule); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar horário — {job?.jobname}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Expressão cron (UTC)</label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="min hora dia mes dow" />
          <p className="text-xs text-muted-foreground">
            Ex: <code>0 12 * * 1-5</code> = todo dia útil às 12h UTC (9h BRT). Formato: minuto hora dia mês dia_semana.
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

function EditAtividadeDialog({ atv, open, onOpenChange, onSave }: { atv: AtividadeRow | null; open: boolean; onOpenChange: (v: boolean) => void; onSave: (patch: Partial<AtividadeRow>) => void }) {
  const [horario, setHorario] = useState(atv?.horario?.slice(0, 5) || '');
  const [dia, setDia] = useState<string>(atv?.dia_semana != null ? String(atv.dia_semana) : '');

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v && atv) { setHorario(atv.horario?.slice(0, 5) || ''); setDia(atv.dia_semana != null ? String(atv.dia_semana) : ''); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar — {atv?.titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Horário</label>
            <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Dia da semana</label>
            <Select value={dia} onValueChange={setDia}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {DIAS_SEMANA.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave({ horario: horario ? `${horario}:00` : null, dia_semana: dia !== '' ? parseInt(dia) : null })}>Salvar</Button>
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
              <p className="font-medium text-sm truncate">{j.jobname}</p>
              <Badge variant={j.active ? 'default' : 'secondary'} className="text-xs">
                {j.active ? 'Ativo' : 'Pausado'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {humanizeSchedule(j.schedule)} · <code className="text-[10px]">{j.schedule}</code>
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

function AtividadesSection({ atividades, onToggle, onEdit }: { atividades: AtividadeRow[]; onToggle: (a: AtividadeRow, v: boolean) => void; onEdit: (a: AtividadeRow) => void }) {
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
  const { atividades, isLoading: loadingAtv, update: updateAtv } = useAllAtividades();

  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [editingAtv, setEditingAtv] = useState<AtividadeRow | null>(null);

  const opJobs = jobs.filter((j) => getCanal(j.jobname) === 'operacional');
  const comJobs = jobs.filter((j) => getCanal(j.jobname) === 'comercial');
  const outros = jobs.filter((j) => getCanal(j.jobname) === 'outro');

  if (loadingJobs || loadingAtv) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Cronograma de Automações</h1>
            <p className="text-sm text-muted-foreground">Jobs agendados e cronograma operacional por canal (D-API × Z-API)</p>
          </div>
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
                <CardTitle className="text-base">Cronograma de atividades — {atividades.length}</CardTitle>
                <p className="text-xs text-muted-foreground">Enviadas via <b>send-cronograma-messages</b> (chip operacional D-API) a cada 3 min.</p>
              </CardHeader>
              <CardContent>
                <AtividadesSection
                  atividades={atividades}
                  onToggle={(a, v) => updateAtv.mutate({ id: a.id, patch: { ativo: v } })}
                  onEdit={setEditingAtv}
                />
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
          updateAtv.mutate(
            { id: editingAtv.id, patch: patch as any },
            { onSuccess: () => setEditingAtv(null) }
          );
        }}
      />
    </Layout>
  );
}
