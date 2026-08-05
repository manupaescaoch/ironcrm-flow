import { CalendarIcon, Filter, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FUNCAO_LABEL, PeriodoPreset, TURNOS, isoDate, parseISODate, presetRange } from '@/lib/operacionalDashboard';
import { OperacionalFiltros } from '@/hooks/useOperacionalDashboard';

interface Props {
  filtros: OperacionalFiltros;
  onChange: (f: OperacionalFiltros) => void;
  preset: PeriodoPreset;
  onPreset: (p: PeriodoPreset) => void;
  unidades: string[];
  funcionarios: string[];
}

const PRESETS: { value: PeriodoPreset; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '15d', label: '15 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

export function OperacionalDashboardFiltros({ filtros, onChange, preset, onPreset, unidades, funcionarios }: Props) {
  const set = (patch: Partial<OperacionalFiltros>) => onChange({ ...filtros, ...patch });

  const handlePreset = (p: PeriodoPreset) => {
    onPreset(p);
    if (p !== 'custom') {
      const r = presetRange(p);
      set({ start: r.start, end: r.end });
    }
  };

  return (
    <Card>
      <CardContent className="p-3 md:p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="w-4 h-4 text-primary" />
          Filtros
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 text-xs"
            onClick={() => {
              onPreset('7d');
              const r = presetRange('7d');
              onChange({ unidade: 'all', turno: 'all', funcao: 'all', funcionario: 'all', start: r.start, end: r.end });
            }}
          >
            <RotateCcw className="w-3 h-3" /> Limpar
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {PRESETS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={preset === p.value ? 'default' : 'outline'}
              className="h-8 shrink-0 text-xs"
              onClick={() => handlePreset(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <Select value={filtros.unidade} onValueChange={(v) => set({ unidade: v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Turno</Label>
            <Select value={filtros.turno} onValueChange={(v) => set({ turno: v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os turnos</SelectItem>
                {TURNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Função</Label>
            <Select value={filtros.funcao} onValueChange={(v) => set({ funcao: v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                {Object.entries(FUNCAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Funcionário</Label>
            <Select value={filtros.funcionario} onValueChange={(v) => set({ funcionario: v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todos</SelectItem>
                {funcionarios.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {(['start', 'end'] as const).map((field) => (
            <div key={field} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{field === 'start' ? 'Data inicial' : 'Data final'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('h-9 w-full justify-start text-xs font-normal')}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {format(parseISODate(filtros[field]), 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISODate(filtros[field])}
                    onSelect={(d) => {
                      if (!d) return;
                      onPreset('custom');
                      set({ [field]: isoDate(d) } as Partial<OperacionalFiltros>);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
