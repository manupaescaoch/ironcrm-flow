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
import { Task, SETORES, PRIORIDADES } from '@/hooks/useTarefasData';

export interface TarefasFiltersState {
  search: string;
  responsavel: string;
  prioridade: string;
  setor: string;
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
    filters.setor;

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      responsavel: '',
      prioridade: '',
      setor: '',
    });
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tarefa..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="pl-9"
        />
      </div>

      {/* Responsável */}
      <Select
        value={filters.responsavel}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, responsavel: value === 'all' ? '' : value })
        }
      >
        <SelectTrigger className="w-[160px]">
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
        <SelectTrigger className="w-[140px]">
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

      {/* Setor */}
      <Select
        value={filters.setor}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, setor: value === 'all' ? '' : value })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Setor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {SETORES.map((setor) => (
            <SelectItem key={setor} value={setor}>
              {setor}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="gap-1 text-muted-foreground"
        >
          <X className="w-4 h-4" />
          Limpar
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

    // Setor filter
    if (filters.setor && task.setor !== filters.setor) {
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
