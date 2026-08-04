import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MESES, formatDateBR } from './constants';
import { cn } from '@/lib/utils';

export type PeriodoModo = 'mes' | 'semana' | 'esta_semana' | 'personalizado';

interface Props {
  modo: PeriodoModo;
  setModo: (modo: PeriodoModo) => void;
  mes: string;
  setMes: (mes: string) => void;
  ano: string;
  setAno: (ano: string) => void;
  semanaRef: string;
  setSemanaRef: (value: string) => void;
  customFrom: string;
  setCustomFrom: (value: string) => void;
  customTo: string;
  setCustomTo: (value: string) => void;
  from: string;
  to: string;
}

const MODOS: { value: PeriodoModo; label: string }[] = [
  { value: 'mes', label: 'Por mês' },
  { value: 'semana', label: 'Por semana' },
  { value: 'esta_semana', label: 'Esta semana' },
  { value: 'personalizado', label: 'Período personalizado' },
];

export function PeriodoSelector(props: Props) {
  const {
    modo,
    setModo,
    mes,
    setMes,
    ano,
    setAno,
    semanaRef,
    setSemanaRef,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    from,
    to,
  } = props;

  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1].map(String);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {MODOS.map((m) => (
          <Button
            key={m.value}
            size="sm"
            variant={modo === m.value ? 'default' : 'outline'}
            onClick={() => setModo(m.value)}
            className="rounded-full"
          >
            {m.label}
          </Button>
        ))}
      </div>

      {modo === 'mes' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {anos.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={ano === a ? 'secondary' : 'ghost'}
                onClick={() => setAno(a)}
                className={cn('h-8 px-3', ano === a && 'font-semibold')}
              >
                {a}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MESES.map((m) => (
              <Button
                key={m.value}
                size="sm"
                variant={mes === m.value ? 'default' : 'outline'}
                onClick={() => setMes(m.value)}
                className="h-8 w-14 px-0"
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {modo === 'semana' && (
        <div className="flex items-center gap-2 max-w-xs">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Semana de</span>
          <Input type="date" value={semanaRef} onChange={(e) => setSemanaRef(e.target.value)} />
        </div>
      )}

      {modo === 'personalizado' && (
        <div className="flex flex-col sm:flex-row gap-2 max-w-md">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Período: <span className="font-medium text-foreground">{formatDateBR(from)}</span> até{' '}
        <span className="font-medium text-foreground">{formatDateBR(to)}</span>
      </p>
    </div>
  );
}

/** Mantido aqui para reutilização em selects simples de mês/ano. */
export function MesAnoSelect({
  mes,
  setMes,
  ano,
  setAno,
}: {
  mes: string;
  setMes: (v: string) => void;
  ano: string;
  setAno: (v: string) => void;
}) {
  const anoAtual = new Date().getFullYear();
  return (
    <div className="flex gap-2">
      <Select value={mes} onValueChange={setMes}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MESES.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={ano} onValueChange={setAno}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1].map((a) => (
            <SelectItem key={a} value={String(a)}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
