import { useState, useMemo } from 'react';
import { useCronogramaAtividades } from '@/hooks/useCronogramaAtividades';
import { useCronogramaFuncionarios } from '@/hooks/useCronogramaFuncionarios';
import { useFormularios } from '@/hooks/useFormulariosData';
import { useUnidadeFilter } from '@/hooks/useUnidadeFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, Trash2, CalendarDays, Phone } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CronogramaTab() {
  const { atividades, isLoading, createAtividade, deleteAtividade } = useCronogramaAtividades();
  const { ativos: funcionarios } = useCronogramaFuncionarios();
  const { data: formularios } = useFormularios();
  const { unidadeId } = useUnidadeFilter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ titulo: '', horario: '', responsavel_id: '', formulario_id: '', dia_semana: '', mensagem: '' });

  const selectedFuncionario = useMemo(() => {
    if (!form.responsavel_id) return null;
    return funcionarios.find(f => f.id === form.responsavel_id) || null;
  }, [form.responsavel_id, funcionarios]);

  const handleCreate = () => {
    if (!form.titulo || !unidadeId) return;
    createAtividade.mutate({
      unidade_id: unidadeId,
      titulo: form.titulo,
      horario: form.horario || undefined,
      responsavel_id: form.responsavel_id || undefined,
      formulario_id: form.formulario_id || undefined,
      dia_semana: form.dia_semana ? parseInt(form.dia_semana) : undefined,
    }, {
      onSuccess: () => {
        setOpen(false);
        setForm({ titulo: '', horario: '', responsavel_id: '', formulario_id: '', dia_semana: '', mensagem: '' });
      },
    });
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          Atividades do Cronograma
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Atividade</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Atividade</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Abertura da unidade" />
              </div>
              <div>
                <Label>Horário</Label>
                <Input type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
              </div>
              <div>
                <Label>Dia da semana</Label>
                <div className="flex gap-1.5 mt-1">
                  {DIAS_SEMANA.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, dia_semana: f.dia_semana === String(i) ? '' : String(i) }))}
                      className={`flex-1 py-2 px-1 text-xs font-medium rounded-md border transition-colors ${
                        form.dia_semana === String(i)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {form.dia_semana === '' ? 'Todos os dias' : `Apenas ${DIAS_SEMANA[Number(form.dia_semana)]}`}
                </p>
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={form.responsavel_id} onValueChange={v => setForm(f => ({ ...f, responsavel_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {funcionarios.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}{f.telefone ? ` — ${f.telefone}` : ''}
                      </SelectItem>
                    ))}
                </Select>
                {selectedFuncionario && (
                  <div className="mt-1.5 flex items-center gap-2 text-xs rounded-md bg-muted px-3 py-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium">{selectedFuncionario.nome}</span>
                    <span className="text-muted-foreground">
                      {selectedFuncionario.telefone
                        ? `— WhatsApp: ${selectedFuncionario.telefone}`
                        : '— Sem WhatsApp cadastrado'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <Label>Formulário vinculado</Label>
                <Select value={form.formulario_id} onValueChange={v => setForm(f => ({ ...f, formulario_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    {formularios?.map(f => <SelectItem key={f.id} value={f.id}>{f.titulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mensagem WhatsApp</Label>
                <Textarea
                  value={form.mensagem}
                  onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))}
                  placeholder="Mensagem que será enviada junto com o link do formulário via WhatsApp..."
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Texto enviado ao responsável no WhatsApp ao acionar a atividade.
                </p>
              </div>
              <Button onClick={handleCreate} disabled={!form.titulo || createAtividade.isPending} className="w-full">
                {createAtividade.isPending ? 'Salvando...' : 'Criar Atividade'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {atividades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma atividade cadastrada.</p>
            <p className="text-xs text-muted-foreground mt-1">Crie atividades para montar o cronograma operacional.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {atividades.map(a => (
            <Card key={a.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {a.horario && (
                    <div className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {a.horario.slice(0, 5)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{a.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {a.cronograma_funcionarios && (
                        <Badge variant="outline" className="text-xs">{a.cronograma_funcionarios.nome}</Badge>
                      )}
                      {a.formularios && (
                        <Badge variant="secondary" className="text-xs">{a.formularios.titulo}</Badge>
                      )}
                      {a.dia_semana !== null && (
                        <Badge variant="outline" className="text-xs">{DIAS_SEMANA[a.dia_semana]}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteAtividade.mutate(a.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}