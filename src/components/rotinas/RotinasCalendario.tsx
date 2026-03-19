import { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, User, Pencil, Trash2, X, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rotina, RotinaAtividade } from '@/hooks/useRotinasData';
import { cn } from '@/lib/utils';

interface Props {
  rotinas: Rotina[];
  atividades: RotinaAtividade[];
  onEdit: (rotina: Rotina) => void;
  onDelete?: (rotina: Rotina) => void;
  canEdit: boolean;
  isAdmin?: boolean;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5);
const DAY_LABELS = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'];
const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

const SETOR_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  'Coordenação': { bg: 'bg-blue-500/90 text-white', border: 'border-blue-600', dot: 'bg-blue-500' },
  'Limpeza': { bg: 'bg-emerald-500/90 text-white', border: 'border-emerald-600', dot: 'bg-emerald-500' },
  'Recepção': { bg: 'bg-orange-500/90 text-white', border: 'border-orange-600', dot: 'bg-orange-500' },
  'Comercial': { bg: 'bg-violet-500/90 text-white', border: 'border-violet-600', dot: 'bg-violet-500' },
  'Treinadores': { bg: 'bg-red-500/90 text-white', border: 'border-red-600', dot: 'bg-red-500' },
  'Manutenção': { bg: 'bg-amber-600/90 text-white', border: 'border-amber-700', dot: 'bg-amber-600' },
  'Geral': { bg: 'bg-slate-500/90 text-white', border: 'border-slate-600', dot: 'bg-slate-500' },
};

const PRIORIDADE_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  'alta': { bg: 'bg-red-500/90 text-white', border: 'border-red-600', dot: 'bg-red-500' },
  'media': { bg: 'bg-amber-500/90 text-white', border: 'border-amber-600', dot: 'bg-amber-500' },
  'baixa': { bg: 'bg-emerald-500/90 text-white', border: 'border-emerald-600', dot: 'bg-emerald-500' },
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
  if (freq === 'unica') return true;
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

function formatDayOfWeek(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function RotinasCalendario({ rotinas, atividades, onEdit, onDelete, canEdit, isAdmin }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<{ rotina: Rotina; dayIdx: number; rect: DOMRect } | null>(null);

  const today = new Date();
  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
  const todayStr = today.toISOString().split('T')[0];
  const isCurrentWeek = weekDates.some(d => d.toISOString().split('T')[0] === todayStr);

  const rotinasByHourDay = useMemo(() => {
    const map: Record<string, Array<{ rotina: Rotina; rotinaAtividades: RotinaAtividade[] }>> = {};
    const active = rotinas.filter(r => r.ativo && !r.arquivada);

    for (const rotina of active) {
      const hour = parseHour(rotina.horario_esperado);
      if (hour === null) continue;

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        if (!rotinaAppliesOnDay(rotina, DAY_KEYS[dayIdx])) continue;
        const key = `${hour}-${dayIdx}`;
        if (!map[key]) map[key] = [];
        map[key].push({ rotina, rotinaAtividades: atividades.filter(a => a.rotina_id === rotina.id) });
      }
    }
    return map;
  }, [rotinas, atividades]);

  const rotinasWithoutTime = useMemo(() =>
    rotinas.filter(r => r.ativo && !r.arquivada && !r.horario_esperado), [rotinas]);

  const nowHour = today.getHours();
  const nowMinutes = today.getMinutes();
  const todayDayIdx = today.getDay();
  const monthYear = weekDates[3].toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const handleEventClick = (rotina: Rotina, dayIdx: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSelectedEvent({ rotina, dayIdx, rect });
  };

  const selectedAtividades = selectedEvent
    ? atividades.filter(a => a.rotina_id === selectedEvent.rotina.id)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Hoje</Button>
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
      </div>

      <div className="border rounded-lg overflow-hidden bg-card relative">
        {/* Day Headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
          <div className="p-2 text-xs text-muted-foreground text-center border-r">GMT-03</div>
          {weekDates.map((date, i) => {
            const isToday = date.toISOString().split('T')[0] === todayStr;
            return (
              <div key={i} className={cn('p-2 text-center border-r last:border-r-0', isToday && 'bg-primary/5')}>
                <div className={cn('text-xs font-medium', isToday ? 'text-primary' : 'text-muted-foreground')}>{DAY_LABELS[i]}</div>
                <div className={cn('text-lg font-bold mt-0.5 inline-flex items-center justify-center', isToday && 'bg-primary text-primary-foreground rounded-full w-9 h-9')}>
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
              const dayRotinas = rotinasWithoutTime.filter(r => rotinaAppliesOnDay(r, DAY_KEYS[dayIdx]));
              return (
                <div key={dayIdx} className="border-r last:border-r-0 p-0.5 min-h-[40px]">
                  {dayRotinas.map(r => {
                    const colors = PRIORIDADE_COLORS[r.prioridade] || PRIORIDADE_COLORS['media'];
                    return (
                      <button key={r.id} onClick={(e) => handleEventClick(r, dayIdx, e)}
                        className={cn('w-full text-left rounded-sm px-1.5 py-1 border-l-[3px] mb-0.5 text-[11px] leading-tight truncate font-medium cursor-pointer hover:opacity-80 transition-opacity', colors.bg, colors.border)}>
                        {r.nome}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Time Grid */}
        <div className="relative overflow-y-auto max-h-[calc(100vh-380px)]">
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0 min-h-[72px]">
              <div className="p-1 text-[11px] text-muted-foreground text-right pr-2 border-r -mt-2">
                {String(hour).padStart(2, '0')}:00
              </div>
              {weekDates.map((date, dayIdx) => {
                const items = rotinasByHourDay[`${hour}-${dayIdx}`] || [];
                const isToday = date.toISOString().split('T')[0] === todayStr;
                return (
                  <div key={dayIdx} className={cn('border-r last:border-r-0 p-0.5 relative', isToday && 'bg-primary/[0.02]')}>
                    {items.map(({ rotina }) => {
                      const colors = SETOR_COLORS[rotina.setor] || SETOR_COLORS['Geral'];
                      const timeLabel = rotina.horario_esperado?.substring(0, 5);
                      return (
                        <button key={rotina.id} onClick={(e) => handleEventClick(rotina, dayIdx, e)}
                          className={cn('w-full text-left rounded-sm px-1.5 py-1 border-l-[3px] mb-0.5 text-[11px] leading-tight cursor-pointer hover:opacity-80 transition-opacity', colors.bg, colors.border)}>
                          <span className="font-semibold truncate block">{rotina.nome}</span>
                          {timeLabel && <span className="opacity-80 text-[10px]">{timeLabel}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}

          {isCurrentWeek && (
            <div className="absolute left-0 right-0 pointer-events-none z-10"
              style={{ top: `${((nowHour - 5) + nowMinutes / 60) / 18 * 100}%` }}>
              <div className="grid grid-cols-[60px_repeat(7,1fr)]">
                <div className="border-r" />
                {weekDates.map((_, i) => (
                  <div key={i} className="relative border-r last:border-r-0">
                    {i === todayDayIdx && (
                      <div className="absolute inset-x-0 flex items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1 shrink-0" />
                        <div className="h-[2px] bg-destructive flex-1" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail Popup (Google Calendar style) */}
        {selectedEvent && (
          <EventDetailPopup
            rotina={selectedEvent.rotina}
            atividades={selectedAtividades}
            date={weekDates[selectedEvent.dayIdx]}
            canEdit={canEdit}
            isAdmin={isAdmin}
            onEdit={() => { onEdit(selectedEvent.rotina); setSelectedEvent(null); }}
            onDelete={onDelete ? () => { onDelete(selectedEvent.rotina); setSelectedEvent(null); } : undefined}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </div>
    </div>
  );
}

function EventDetailPopup({ rotina, atividades, date, canEdit, isAdmin, onEdit, onDelete, onClose }: {
  rotina: Rotina; atividades: RotinaAtividade[]; date: Date;
  canEdit: boolean; isAdmin?: boolean;
  onEdit: () => void; onDelete?: () => void; onClose: () => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const colors = SETOR_COLORS[rotina.setor] || SETOR_COLORS['Geral'];
  const timeLabel = rotina.horario_esperado?.substring(0, 5);
  const dayLabel = formatDayOfWeek(date);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40" />
      <div ref={popupRef}
        className="fixed z-50 bg-popover border rounded-xl shadow-xl w-[360px] max-w-[90vw] overflow-hidden animate-in fade-in-0 zoom-in-95"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        {/* Header actions */}
        <div className="flex items-center justify-end gap-1 px-3 pt-3">
          {canEdit && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {isAdmin && onDelete && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 space-y-3">
          {/* Title with color dot */}
          <div className="flex items-start gap-3">
            <div className={cn('w-4 h-4 rounded-sm mt-1 shrink-0', colors.dot)} />
            <div>
              <h3 className="text-lg font-semibold leading-tight">{rotina.nome}</h3>
              <p className="text-sm text-muted-foreground capitalize mt-0.5">
                {dayLabel}
                {timeLabel && ` · ${timeLabel}`}
              </p>
            </div>
          </div>

          {/* Description */}
          {rotina.descricao && (
            <div className="flex items-start gap-3">
              <List className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{rotina.descricao}</p>
            </div>
          )}

          {/* Responsible */}
          {rotina.responsavel_principal && (
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm">{rotina.responsavel_principal}</span>
            </div>
          )}

          {/* Setor badge */}
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <Badge variant="secondary" className="text-xs">{rotina.setor}</Badge>
          </div>

          {/* Activities */}
          {atividades.length > 0 && (
            <div className="border-t pt-3 space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Atividades ({atividades.length})</span>
              {atividades.map(at => (
                <div key={at.id} className="text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                  {at.titulo}
                  {at.responsavel && <span className="text-xs text-muted-foreground ml-auto">{at.responsavel}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
