import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Task, TaskInsert, SETORES, PRIORIDADES } from '@/hooks/useTarefasData';
import { useUnidade } from '@/contexts/UnidadeContext';

const formSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().optional(),
  responsavel: z.string().min(1, 'Responsável é obrigatório'),
  setor: z.string().min(1, 'Setor é obrigatório'),
  prioridade: z.enum(['alta', 'media', 'baixa']),
  prazo: z.date().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface TarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onSave: (data: TaskInsert) => Promise<void>;
  isLoading?: boolean;
}

export function TarefaModal({
  open,
  onOpenChange,
  task,
  onSave,
  isLoading,
}: TarefaModalProps) {
  const { unidadeAtual } = useUnidade();
  const isEditing = !!task;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      responsavel: '',
      setor: '',
      prioridade: 'media',
      prazo: null,
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        titulo: task.titulo,
        descricao: task.descricao || '',
        responsavel: task.responsavel,
        setor: task.setor,
        prioridade: task.prioridade,
        prazo: task.prazo ? new Date(task.prazo) : null,
      });
    } else {
      form.reset({
        titulo: '',
        descricao: '',
        responsavel: '',
        setor: '',
        prioridade: 'media',
        prazo: null,
      });
    }
  }, [task, form, open]);

  const handleSubmit = async (data: FormData) => {
    if (!unidadeAtual) return;

    const taskData: TaskInsert = {
      titulo: data.titulo,
      descricao: data.descricao || null,
      responsavel: data.responsavel,
      setor: data.setor,
      prioridade: data.prioridade,
      status: task?.status || 'a_fazer',
      prazo: data.prazo ? format(data.prazo, 'yyyy-MM-dd') : null,
      unidade_id: unidadeAtual.id,
    };

    await onSave(taskData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}
          </DialogTitle>
        </DialogHeader>

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável *</Label>
              <Input
                id="responsavel"
                placeholder="Nome do responsável"
                {...form.register('responsavel')}
                className={cn(form.formState.errors.responsavel && 'border-destructive')}
              />
            </div>

            <div className="space-y-2">
              <Label>Setor *</Label>
              <Select
                value={form.watch('setor')}
                onValueChange={(value) => form.setValue('setor', value)}
              >
                <SelectTrigger className={cn(form.formState.errors.setor && 'border-destructive')}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {SETORES.map((setor) => (
                    <SelectItem key={setor} value={setor}>
                      {setor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <DialogFooter className="gap-2">
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
