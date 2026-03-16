import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, User, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Rotina, RotinaAtividade, RotinaExecucao, PRIORIDADES_ROTINA } from '@/hooks/useRotinasData';
import { cn } from '@/lib/utils';

interface Props {
  rotinas: Rotina[];
  atividades: RotinaAtividade[];
  execucoes: RotinaExecucao[];
  onEdit: (rotina: Rotina) => void;
  onToggleExecucao: (rotinaId: string, atividadeId: string | null, concluida: boolean) => void;
  canEdit: boolean;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 05:00 to 22:00
const DAY_LABELS = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'];
const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

const SETOR_COLORS: Record<string, string> = {
  'Coordenação': 'bg-blue-500/90 border-blue-600 text-white',
  'Limpeza': 'bg-emerald-500/90 border-emerald-600 text-white',
  'Recepção': 'bg-orange-500/90 border-orange-600 text-white',
  'Comercial': 'bg-violet-500/90 border-violet-600 text-white',
  'Treinadores': 'bg-red-500/90 border-red-600 text-white',
  'Manutenção': 'bg-amber-600/90 border-amber-700 text-white',
  'Geral': 'bg-slate-500/90 border-slate-600 text-white',
};

function getWeekDates(baseDate: Date): Date[] {
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function rotinaAppliesOnDay(rotina: Rotina, dayKey: string): boolean {
  const freq = rotina.frequencia;
  if (freq === 'diaria') return true;
  if (freq === 'unica') return true; // show on all days for simplicity
  if (freq.startsWith('semanal:')) {
    const dias = freq.split(':')[1].split(',');
    return dias.includes(dayKey);
  }
  return true;
}

function parseHour(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const h = parseInt(timeStr.substring(0, 2), 10);
  return isNaN(h) ? null : h;
}

export function RotinasCalendario({ rotinas, atividades, execucoes, onEdit, onToggleExecucao, canEdit }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedRotina, setExpandedRotina] = useState<string | null>(null);

  const today = new Date();
  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);

  const todayStr = today.toISOString().split('T')[0];
  const isCurrentWeek = weekDates.some(d => d.toISOString().split('T')[0] === todayStr);

  // Group rotinas by hour and day
  const rotinasByHourDay = useMemo(() => {
    const map: Record<string, Array<{ rotina: Rotina; rotinaAtividades: RotinaAtividade[] }>> = {};

    const activeRotinas = rotinas.filter(r => r.ativo && !r.arquivada);

    for (const rotina of activeRotinas) {
      const hour = parseHour(rotina.horario_esperado);
      if (hour === null) continue;

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const dayKey = DAY_KEYS[dayIdx];
        if (!rotinaAppliesOnDay(rotina, dayKey)) continue;

        const key = `${hour}-${dayIdx}`;
        if (!map[key]) map[key] = [];

        const rotinaAtividades = atividades.filter(a => a.rotina_id === rotina.id);
        map[key].push({ rotina, rotinaAtividades });
      }
    }

    return map;
  }, [rotinas, atividades]);

  // Rotinas without time (shown separately)
  const rotinasWithoutTime = useMemo(() =>
    rotinas.filter(r => r.ativo && !r.arquivada && !r.horario_esperado),
    [rotinas]
  );

  const nowHour = today.getHours();
  const nowMinutes = today.getMinutes();
  const todayDayIdx = today.getDay();

  const monthYear = weekDates[3].toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
            Hoje
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold capitalize">{monthYear}</h2>
        </div>
        <Badge variant="outline" className="text-xs">Semana</Badge>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Day Headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
          <div className="p-2 text-xs text-muted-foreground text-center border-r">GMT-03</div>
          {weekDates.map((date, i) => {
            const isToday = date.toISOString().split('T')[0] === todayStr;
            return (
              <div key={i} className={cn(
                'p-2 text-center border-r last:border-r-0',
                isToday && 'bg-primary/5'
              )}>
                <div className={cn(
                  'text-xs font-medium',
                  isToday ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {DAY_LABELS[i]}
                </div>
                <div className={cn(
                  'text-lg font-bold mt-0.5 inline-flex items-center justify-center',
                  isToday && 'bg-primary text-primary-foreground rounded-full w-9 h-9'
                )}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rotinas sem horário */}
        {rotinasWithoutTime.length > 0 && (
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/10">
            <div className="p-1 text-[10px] text-muted-foreground text-right pr-2 border-r flex items-center justify-end">
              <Clock className="w-3 h-3" />
            </div>
            {weekDates.map((_, dayIdx) => {
              const dayKey = DAY_KEYS[dayIdx];
              const dayRotinas = rotinasWithoutTime.filter(r => rotinaAppliesOnDay(r, dayKey));
              return (
                <div key={dayIdx} className="border-r last:border-r-0 p-0.5 min-h-[32px]">
                  {dayRotinas.map(r => (
                    <CalendarEvent
                      key={r.id}
                      rotina={r}
                      rotinaAtividades={atividades.filter(a => a.rotina_id === r.id)}
                      execucoes={execucoes}
                      onEdit={onEdit}
                      onToggle={onToggleExecucao}
                      expanded={expandedRotina === `${r.id}-${dayIdx}`}
                      onExpand={() => setExpandedRotina(expandedRotina === `${r.id}-${dayIdx}` ? null : `${r.id}-${dayIdx}`)}
                      compact
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Time Grid */}
        <div className="relative overflow-y-auto max-h-[calc(100vh-380px)]">
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0 min-h-[64px]">
              <div className="p-1 text-[11px] text-muted-foreground text-right pr-2 border-r -mt-2">
                {String(hour).padStart(2, '0')}:00
              </div>
              {weekDates.map((date, dayIdx) => {
                const key = `${hour}-${dayIdx}`;
                const items = rotinasByHourDay[key] || [];
                const isToday = date.toISOString().split('T')[0] === todayStr;

                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      'border-r last:border-r-0 p-0.5 relative',
                      isToday && 'bg-primary/[0.02]'
                    )}
                  >
                    {items.map(({ rotina, rotinaAtividades }) => (
                      <CalendarEvent
                        key={rotina.id}
                        rotina={rotina}
                        rotinaAtividades={rotinaAtividades}
                        execucoes={execucoes}
                        onEdit={onEdit}
                        onToggle={onToggleExecucao}
                        expanded={expandedRotina === `${rotina.id}-${dayIdx}`}
                        onExpand={() => setExpandedRotina(expandedRotina === `${rotina.id}-${dayIdx}` ? null : `${rotina.id}-${dayIdx}`)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Current time indicator */}
          {isCurrentWeek && (
            <div
              className="absolute left-0 right-0 pointer-events-none z-10"
              style={{
                top: `${((nowHour - 5) + nowMinutes / 60) / 18 * 100}%`,
              }}
            >
              <div className="grid grid-cols-[60px_repeat(7,1fr)]">
                <div className="border-r" />
                {weekDates.map((_, i) => (
                  <div key={i} className="relative border-r last:border-r-0">
                    {i === todayDayIdx && (
                      <div className="absolute inset-x-0 flex items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shrink-0" />
                        <div className="h-[2px] bg-red-500 flex-1" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Calendar Event Block ---

interface CalendarEventProps {
  rotina: Rotina;
  rotinaAtividades: RotinaAtividade[];
  execucoes: RotinaExecucao[];
  onEdit: (rotina: Rotina) => void;
  onToggle: (rotinaId: string, atividadeId: string | null, concluida: boolean) => void;
  expanded: boolean;
  onExpand: () => void;
  compact?: boolean;
}

function CalendarEvent({ rotina, rotinaAtividades, execucoes, onEdit, onToggle, expanded, onExpand, compact }: CalendarEventProps) {
  const concluidasCount = rotinaAtividades.filter(a =>
    execucoes.some(e => e.atividade_id === a.id && e.concluida)
  ).length;
  const allDone = rotinaAtividades.length > 0 && concluidasCount === rotinaAtividades.length;
  const colorClass = SETOR_COLORS[rotina.setor] || SETOR_COLORS['Geral'];

  const timeLabel = rotina.horario_esperado
    ? rotina.horario_esperado.substring(0, 5)
    : null;

  return (
    <div className="mb-0.5">
      <button
        onClick={onExpand}
        className={cn(
          'w-full text-left rounded px-1.5 py-1 border-l-[3px] transition-all text-[11px] leading-tight',
          colorClass,
          allDone && 'opacity-60 line-through',
          compact ? 'py-0.5' : 'py-1'
        )}
      >
        <div className="font-semibold truncate">{rotina.nome}</div>
        {timeLabel && !compact && (
          <div className="opacity-80 text-[10px]">{timeLabel}</div>
        )}
        {rotinaAtividades.length > 0 && (
          <div className="opacity-80 text-[10px] flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            {concluidasCount}/{rotinaAtividades.length}
          </div>
        )}
      </button>

      {expanded && (
        <div className="absolute z-20 left-1 right-1 top-full bg-popover border rounded-lg shadow-lg p-3 min-w-[220px] space-y-2"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">{rotina.nome}</h4>
            <button
              onClick={() => onEdit(rotina)}
              className="text-xs text-primary hover:underline"
            >
              Editar
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px]">{rotina.setor}</Badge>
            {timeLabel && (
              <Badge variant="outline" className="text-[10px] gap-0.5">
                <Clock className="w-2.5 h-2.5" />{timeLabel}
              </Badge>
            )}
          </div>

          {rotina.responsavel_principal && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />{rotina.responsavel_principal}
            </div>
          )}

          {rotina.descricao && (
            <p className="text-xs text-muted-foreground">{rotina.descricao}</p>
          )}

          {rotinaAtividades.length > 0 && (
            <div className="space-y-1 pt-1 border-t">
              {rotinaAtividades.map(at => {
                const done = execucoes.some(e => e.atividade_id === at.id && e.concluida);
                return (
                  <div key={at.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={done}
                      onCheckedChange={(checked) => onToggle(rotina.id, at.id, !!checked)}
                    />
                    <span className={cn('text-xs flex-1', done && 'line-through text-muted-foreground')}>
                      {at.titulo}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
