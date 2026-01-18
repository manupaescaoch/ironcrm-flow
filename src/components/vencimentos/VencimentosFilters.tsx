import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VencimentosFilters as FiltersType, VencimentoStatus } from '@/hooks/useVencimentosData';

interface VencimentosFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  planosDisponiveis: string[];
}

const statusOptions: { value: VencimentoStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'vencido', label: '🔴 Vencidos' },
  { value: 'urgente', label: '🟠 Urgente (7 dias)' },
  { value: 'atencao', label: '🟡 Atenção (15 dias)' },
  { value: 'proximo', label: '🔵 Próximo (30 dias)' },
  { value: 'ok', label: '🟢 OK (+30 dias)' },
];

export function VencimentosFilters({ filters, onFiltersChange, planosDisponiveis }: VencimentosFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={filters.status}
        onValueChange={(value) => onFiltersChange({ ...filters, status: value as FiltersType['status'] })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.plano}
        onValueChange={(value) => onFiltersChange({ ...filters, plano: value })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Plano" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os planos</SelectItem>
          {planosDisponiveis.map((plano) => (
            <SelectItem key={plano} value={plano}>
              {plano}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
