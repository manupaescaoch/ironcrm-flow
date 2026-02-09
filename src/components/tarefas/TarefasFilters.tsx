import { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Task, PRIORIDADES } from '@/hooks/useTarefasData';

export interface TarefasFiltersState {
  search: string;
  responsavel: string;
  prioridade: string;
  recorrencia: string;
}

interface TarefasFiltersProps {
  tasks: Task[];
  filters: TarefasFiltersState;
  onFiltersChange: (filters: TarefasFiltersState) => void;
}

export function TarefasFilters({
  tasks,
  filters,
  onFiltersChange,
}: TarefasFiltersProps) {
  // Extract unique responsáveis from tasks
  const responsaveis = useMemo(() => {
    const uniqueResponsaveis = [...new Set(tasks.map((t) => t.responsavel))];
    return uniqueResponsaveis.sort();
  }, [tasks]);

  const hasActiveFilters =
    filters.search ||
    filters.responsavel ||
    filters.prioridade ||
    filters.recorrencia;

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      responsavel: '',
      prioridade: '',
      recorrencia: '',
    });
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar tarefa..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Responsável */}
      <Select
        value={filters.responsavel}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, responsavel: value === 'all' ? '' : value })
        }
      >
        <SelectTrigger className="w-[130px] h-9 text-sm">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {responsaveis.map((resp) => (
            <SelectItem key={resp} value={resp}>
              {resp}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Prioridade */}
      <Select
        value={filters.prioridade}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, prioridade: value === 'all' ? '' : value })
        }
      >
        <SelectTrigger className="w-[110px] h-9 text-sm">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {PRIORIDADES.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Recorrência */}
      <Select
        value={filters.recorrencia || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, recorrencia: value === 'all' ? '' : value })
        }
      >
        <SelectTrigger className="w-[120px] h-9 text-sm">
          <SelectValue placeholder="Recorrência" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="recorrente">Recorrentes</SelectItem>
          <SelectItem value="unica">Únicas</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="gap-1 text-muted-foreground h-9 px-2"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

// Helper function to filter tasks
export function filterTasks(
  tasks: Task[],
  filters: TarefasFiltersState
): Task[] {
  return tasks.filter((task) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        task.titulo.toLowerCase().includes(searchLower) ||
        task.descricao?.toLowerCase().includes(searchLower) ||
        task.responsavel.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Responsável filter
    if (filters.responsavel && task.responsavel !== filters.responsavel) {
      return false;
    }

    // Prioridade filter
    if (filters.prioridade && task.prioridade !== filters.prioridade) {
      return false;
    }

    // Recorrência filter
    if (filters.recorrencia === 'recorrente' && !task.recorrencia) {
      return false;
    }
    if (filters.recorrencia === 'unica' && task.recorrencia) {
      return false;
    }

    return true;
  });
}

// Helper function to sort tasks within columns
export function sortTasksByPriorityAndDeadline(tasks: Task[]): Task[] {
  const priorityOrder = { alta: 0, media: 1, baixa: 2 };

  return [...tasks].sort((a, b) => {
    // First by priority
    const priorityDiff =
      priorityOrder[a.prioridade] - priorityOrder[b.prioridade];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by deadline (earliest first, null last)
    if (a.prazo && b.prazo) {
      return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
    }
    if (a.prazo) return -1;
    if (b.prazo) return 1;

    return 0;
  });
}
