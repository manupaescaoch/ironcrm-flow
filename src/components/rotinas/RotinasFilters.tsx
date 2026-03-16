import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SETORES, FREQUENCIAS, PRIORIDADES_ROTINA, Rotina } from '@/hooks/useRotinasData';
import { Search } from 'lucide-react';

export interface RotinasFiltersState {
  search: string;
  setor: string;
  responsavel: string;
  frequencia: string;
  prioridade: string;
  showArchived: boolean;
}

interface Props {
  filters: RotinasFiltersState;
  onChange: (filters: RotinasFiltersState) => void;
  rotinas: Rotina[];
}

export function RotinasFilters({ filters, onChange, rotinas }: Props) {
  const responsaveis = [...new Set(rotinas.map(r => r.responsavel_principal).filter(Boolean) as string[])];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar rotina..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>
      <Select value={filters.setor} onValueChange={(v) => onChange({ ...filters, setor: v })}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Setor" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.frequencia} onValueChange={(v) => onChange({ ...filters, frequencia: v })}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Frequência" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          {FREQUENCIAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.prioridade} onValueChange={(v) => onChange({ ...filters, prioridade: v })}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          {PRIORIDADES_ROTINA.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {responsaveis.length > 0 && (
        <Select value={filters.responsavel} onValueChange={(v) => onChange({ ...filters, responsavel: v })}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {responsaveis.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <div className="flex items-center gap-2">
        <Switch
          id="showArchived"
          checked={filters.showArchived}
          onCheckedChange={(v) => onChange({ ...filters, showArchived: v })}
        />
        <Label htmlFor="showArchived" className="text-sm text-muted-foreground">Arquivadas</Label>
      </div>
    </div>
  );
}

export function filterRotinas(rotinas: Rotina[], filters: RotinasFiltersState): Rotina[] {
  return rotinas.filter(r => {
    if (!filters.showArchived && r.arquivada) return false;
    if (filters.search && !r.nome.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.setor && filters.setor !== 'todos' && r.setor !== filters.setor) return false;
    if (filters.frequencia && filters.frequencia !== 'todas' && r.frequencia.split(':')[0] !== filters.frequencia) return false;
    if (filters.prioridade && filters.prioridade !== 'todas' && r.prioridade !== filters.prioridade) return false;
    if (filters.responsavel && filters.responsavel !== 'todos' && r.responsavel_principal !== filters.responsavel) return false;
    return true;
  });
}
