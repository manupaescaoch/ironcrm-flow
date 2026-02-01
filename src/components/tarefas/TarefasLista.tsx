import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { cn } from '@/lib/utils';
import { Task, SETORES, PRIORIDADES, STATUS_CONFIG } from '@/hooks/useTarefasData';
import { useAuth } from '@/contexts/AuthContext';

interface TarefasListaProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
}

type SortField = 'titulo' | 'responsavel' | 'setor' | 'prioridade' | 'prazo' | 'status';
type SortOrder = 'asc' | 'desc';

export function TarefasLista({
  tasks,
  onTaskClick,
  onDeleteTask,
}: TarefasListaProps) {
  const { isAdmin } = useAuth();
  const [filterResponsavel, setFilterResponsavel] = useState('all');
  const [filterPrioridade, setFilterPrioridade] = useState('all');
  const [filterSetor, setFilterSetor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState<SortField>('prazo');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const responsaveis = useMemo(
    () => [...new Set(tasks.map((t) => t.responsavel))].sort(),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterResponsavel !== 'all' && task.responsavel !== filterResponsavel)
        return false;
      if (filterPrioridade !== 'all' && task.prioridade !== filterPrioridade)
        return false;
      if (filterSetor !== 'all' && task.setor !== filterSetor) return false;
      if (filterStatus !== 'all' && task.status !== filterStatus) return false;
      return true;
    });
  }, [tasks, filterResponsavel, filterPrioridade, filterSetor, filterStatus]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'titulo':
          comparison = a.titulo.localeCompare(b.titulo);
          break;
        case 'responsavel':
          comparison = a.responsavel.localeCompare(b.responsavel);
          break;
        case 'setor':
          comparison = a.setor.localeCompare(b.setor);
          break;
        case 'prioridade':
          const prioridadeOrder = { alta: 0, media: 1, baixa: 2 };
          comparison = prioridadeOrder[a.prioridade] - prioridadeOrder[b.prioridade];
          break;
        case 'status':
          const statusOrder = { a_fazer: 0, em_andamento: 1, aguardando: 2, concluida: 3 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'prazo':
          if (!a.prazo && !b.prazo) comparison = 0;
          else if (!a.prazo) comparison = 1;
          else if (!b.prazo) comparison = -1;
          else comparison = new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredTasks, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getPrioridadeConfig = (prioridade: string) =>
    PRIORIDADES.find((p) => p.value === prioridade);

  const getStatusConfig = (status: string) =>
    STATUS_CONFIG.find((s) => s.value === status);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-lg border">
        <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            {responsaveis.map((resp) => (
              <SelectItem key={resp} value={resp}>
                {resp}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSetor} onValueChange={setFilterSetor}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos setores</SelectItem>
            {SETORES.map((setor) => (
              <SelectItem key={setor} value={setor}>
                {setor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {PRIORIDADES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {STATUS_CONFIG.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('titulo')}
              >
                <div className="flex items-center gap-2">
                  Título
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('responsavel')}
              >
                <div className="flex items-center gap-2">
                  Responsável
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('setor')}
              >
                <div className="flex items-center gap-2">
                  Setor
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('prioridade')}
              >
                <div className="flex items-center gap-2">
                  Prioridade
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('prazo')}
              >
                <div className="flex items-center gap-2">
                  Prazo
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-2">
                  Status
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhuma tarefa encontrada
                </TableCell>
              </TableRow>
            ) : (
              sortedTasks.map((task) => {
                const prioridadeConfig = getPrioridadeConfig(task.prioridade);
                const statusConfig = getStatusConfig(task.status);

                return (
                  <TableRow key={task.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium max-w-[250px] truncate">
                      {task.titulo}
                    </TableCell>
                    <TableCell>{task.responsavel}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {task.setor}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('text-xs', prioridadeConfig?.color)}
                      >
                        {prioridadeConfig?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.prazo
                        ? format(new Date(task.prazo), 'dd/MM/yyyy', {
                            locale: ptBR,
                          })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full',
                            statusConfig?.color
                          )}
                        />
                        <span className="text-sm">{statusConfig?.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onTaskClick(task)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Excluir tarefa?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. A tarefa será
                                  permanentemente excluída.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDeleteTask(task.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
