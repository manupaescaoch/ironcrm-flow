import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Clock, Loader2, MessageSquare, CheckSquare, History, Trash2, Repeat } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Task, TaskInsert, PRIORIDADES, STATUS_CONFIG, RECORRENCIA_OPTIONS, DIAS_SEMANA } from '@/hooks/useTarefasData';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useUnidadeUsers } from '@/hooks/useUnidadeUsers';
import { TaskComments } from './TaskComments';
import { TaskSubtasks } from './TaskSubtasks';
import { TaskHistory } from './TaskHistory';

const formSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().optional(),
  responsavel: z.string().min(1, 'Responsável é obrigatório'),
  prioridade: z.enum(['alta', 'media', 'baixa']),
  prazo: z.date().optional().nullable(),
  hora_prazo: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface TarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onSave: (data: TaskInsert) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  isLoading?: boolean;
}

// Helper to parse recorrencia string
function parseRecorrencia(recorrencia: string | null): { tipo: string; dias: string[] } {
  if (!recorrencia) return { tipo: '', dias: [] };
  if (recorrencia.startsWith('semanal:')) {
    const dias = recorrencia.replace('semanal:', '').split(',');
    return { tipo: 'semanal', dias };
  }
  return { tipo: recorrencia, dias: [] };
}

function buildRecorrencia(tipo: string, dias: string[]): string | null {
  if (!tipo) return null;
  if (tipo === 'semanal') {
    if (dias.length === 0) return null;
    return `semanal:${dias.join(',')}`;
  }
  return tipo;
}

export function TarefaModal({
  open,
  onOpenChange,
  task,
  onSave,
  onDelete,
  isLoading,
}: TarefaModalProps) {
  const { unidadeAtual } = useUnidade();
  const { users, loading: usersLoading } = useUnidadeUsers();
  const { isAdmin } = useAuth();
  const isEditing = !!task;
  const [activeTab, setActiveTab] = useState('detalhes');
  const [selectedStatus, setSelectedStatus] = useState<Task['status']>('a_fazer');
  const [recorrenciaTipo, setRecorrenciaTipo] = useState('');
  const [recorrenciaDias, setRecorrenciaDias] = useState<string[]>([]);
  const [recorrenciaFim, setRecorrenciaFim] = useState<Date | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      responsavel: '',
      prioridade: 'media',
      prazo: null,
      hora_prazo: null,
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        titulo: task.titulo,
        descricao: task.descricao || '',
        responsavel: task.responsavel,
        prioridade: task.prioridade,
        prazo: task.prazo ? (() => { const [y, m, d] = task.prazo!.split('-').map(Number); return new Date(y, m - 1, d); })() : null,
        hora_prazo: task.hora_prazo || null,
      });
      setSelectedStatus(task.status);
      const parsed = parseRecorrencia(task.recorrencia);
      setRecorrenciaTipo(parsed.tipo);
      setRecorrenciaDias(parsed.dias);
      setRecorrenciaFim(task.recorrencia_fim ? new Date(task.recorrencia_fim) : null);
    } else {
      form.reset({
        titulo: '',
        descricao: '',
        responsavel: '',
        prioridade: 'media',
        prazo: null,
        hora_prazo: null,
      });
      setSelectedStatus('a_fazer');
      setRecorrenciaTipo('');
      setRecorrenciaDias([]);
      setRecorrenciaFim(null);
      setActiveTab('detalhes');
    }
  }, [task, form, open]);

  const handleSubmit = async (data: FormData) => {
    if (!unidadeAtual) return;

    const taskData: TaskInsert = {
      titulo: data.titulo,
      descricao: data.descricao || null,
      responsavel: data.responsavel,
      setor: '',
      prioridade: data.prioridade,
      status: selectedStatus,
      prazo: data.prazo ? format(data.prazo, 'yyyy-MM-dd') : null,
      hora_prazo: data.hora_prazo || null,
      unidade_id: unidadeAtual.id,
      recorrencia: buildRecorrencia(recorrenciaTipo, recorrenciaDias),
      recorrencia_fim: recorrenciaFim ? format(recorrenciaFim, 'yyyy-MM-dd') : null,
    };

    await onSave(taskData);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (task && onDelete) {
      await onDelete(task.id);
      onOpenChange(false);
    }
  };

  const toggleDia = (dia: string) => {
    setRecorrenciaDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const selectedResponsavel = form.watch('responsavel');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="checklist" disabled={!isEditing} className="gap-1">
              <CheckSquare className="w-3 h-3" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="comentarios" disabled={!isEditing} className="gap-1">
              <MessageSquare className="w-3 h-3" />
              Comentários
            </TabsTrigger>
            <TabsTrigger value="historico" disabled={!isEditing} className="gap-1">
              <History className="w-3 h-3" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="flex-1 overflow-y-auto mt-4">
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  placeholder="Digite o título da tarefa"
                  {...form.register('titulo')}
                  className={cn(form.formState.errors.titulo && 'border-destructive')}
                />
                {form.formState.errors.titulo && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.titulo.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva a tarefa em detalhes"
                  rows={3}
                  {...form.register('descricao')}
                />
              </div>

              <div className="space-y-2">
                <Label>Responsável *</Label>
                {usersLoading ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                ) : users.length > 0 ? (
                  <Select
                    value={selectedResponsavel}
                    onValueChange={(value) => form.setValue('responsavel', value)}
                  >
                    <SelectTrigger className={cn(form.formState.errors.responsavel && 'border-destructive')}>
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.name}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Nome do responsável"
                    {...form.register('responsavel')}
                    className={cn(form.formState.errors.responsavel && 'border-destructive')}
                  />
                )}
                {form.formState.errors.responsavel && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.responsavel.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Prioridade *</Label>
                <Select
                  value={form.watch('prioridade')}
                  onValueChange={(value: 'alta' | 'media' | 'baixa') =>
                    form.setValue('prioridade', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full',
                              p.value === 'alta' && 'bg-red-500',
                              p.value === 'media' && 'bg-yellow-500',
                              p.value === 'baixa' && 'bg-green-500'
                            )}
                          />
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isEditing && (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={(value: Task['status']) => setSelectedStatus(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_CONFIG.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="flex items-center gap-2">
                            <span className={cn('w-2 h-2 rounded-full', s.color)} />
                            {s.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !form.watch('prazo') && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.watch('prazo')
                          ? format(form.watch('prazo')!, 'dd/MM/yyyy')
                          : 'Selecionar data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.watch('prazo') || undefined}
                        onSelect={(date) => form.setValue('prazo', date || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Horário</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      className="pl-9"
                      value={form.watch('hora_prazo') || ''}
                      onChange={(e) => form.setValue('hora_prazo', e.target.value || null)}
                    />
                  </div>
                </div>
              </div>

              {/* Recorrência */}
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-muted-foreground" />
                  <Label className="mb-0">Recorrência</Label>
                </div>
                <Select
                  value={recorrenciaTipo || 'nenhuma'}
                  onValueChange={(value) => {
                    setRecorrenciaTipo(value === 'nenhuma' ? '' : value);
                    if (value !== 'semanal') setRecorrenciaDias([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORRENCIA_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value || 'nenhuma'} value={opt.value || 'nenhuma'}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {recorrenciaTipo === 'semanal' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Dias da semana</Label>
                    <div className="flex flex-wrap gap-2">
                      {DIAS_SEMANA.map((dia) => (
                        <label
                          key={dia.value}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors',
                            recorrenciaDias.includes(dia.value)
                              ? 'bg-primary/10 border-primary text-primary'
                              : 'bg-card border-border text-muted-foreground hover:bg-muted'
                          )}
                        >
                          <Checkbox
                            checked={recorrenciaDias.includes(dia.value)}
                            onCheckedChange={() => toggleDia(dia.value)}
                            className="w-3 h-3"
                          />
                          {dia.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {recorrenciaTipo && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Repetir até (opcional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !recorrenciaFim && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {recorrenciaFim
                            ? format(recorrenciaFim, 'dd/MM/yyyy')
                            : 'Sem data de fim'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={recorrenciaFim || undefined}
                          onSelect={(date) => setRecorrenciaFim(date || null)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                {isEditing && isAdmin && onDelete ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir tarefa permanentemente?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. A tarefa será excluída permanentemente do sistema.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={handleDelete}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <div />
                )}
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="checklist" className="flex-1 overflow-hidden mt-4">
            {task && <TaskSubtasks taskId={task.id} />}
          </TabsContent>

          <TabsContent value="comentarios" className="flex-1 overflow-hidden mt-4">
            {task && <TaskComments taskId={task.id} />}
          </TabsContent>

          <TabsContent value="historico" className="flex-1 overflow-hidden mt-4">
            {task && <TaskHistory taskId={task.id} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
