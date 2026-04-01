import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useCronogramaAtividades } from '@/hooks/useCronogramaAtividades';
import { useCronogramaFuncionarios } from '@/hooks/useCronogramaFuncionarios';
import { useFormularios } from '@/hooks/useFormulariosData';
import { useUnidadeFilter } from '@/hooks/useUnidadeFilter';
import { useRotinasData, Rotina, RotinaAtividade } from '@/hooks/useRotinasData';
import { useAuth } from '@/contexts/AuthContext';
import { RotinaModal } from '@/components/rotinas/RotinaModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { Plus, Clock, Trash2, CalendarDays, Phone, ChevronLeft, ChevronRight, Pencil, X, FileText, User, MessageSquare, CheckSquare, Square, CheckCheck, ClipboardList, List } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CronogramaAtividade } from '@/hooks/useCronogramaAtividades';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_LABELS = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'];
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 05:00 - 23:00

function getWeekDates(baseDate: Date): Date[] {
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function parseHour(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const h = parseInt(timeStr.substring(0, 2), 10);
  return isNaN(h) ? null : h;
}

const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

const PRIORIDADE_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  'alta': { bg: 'bg-red-500/90 text-white', border: 'border-red-600', dot: 'bg-red-500' },
  'media': { bg: 'bg-amber-500/90 text-white', border: 'border-amber-600', dot: 'bg-amber-500' },
  'baixa': { bg: 'bg-emerald-500/90 text-white', border: 'border-emerald-600', dot: 'bg-emerald-500' },
};

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

export function CronogramaTab() {
  const { atividades, isLoading, createAtividade, updateAtividade, bulkUpdateAtividades, bulkDeleteAtividades, deleteAtividade } = useCronogramaAtividades();
  const { ativos: funcionarios } = useCronogramaFuncionarios();
  const { data: formularios } = useFormularios();
  const { unidadeId } = useUnidadeFilter();
  const { isAdmin, userRole } = useAuth();

  // Rotinas data
  const {
    rotinas, atividades: rotinaAtividades, execucoes, loading: rotinasLoading,
    createRotina, updateRotina, deleteRotina: deleteRotinaFn, duplicateRotina,
    toggleExecucao, saveAtividades: saveRotinaAtividades,
  } = useRotinasData();

  const canEditRotina = isAdmin || userRole === 'coordenador' || userRole === 'comercial';

  // Rotina modal state
  const [rotinaModalOpen, setRotinaModalOpen] = useState(false);
  const [selectedRotina, setSelectedRotina] = useState<Rotina | null>(null);
  const [savingRotina, setSavingRotina] = useState(false);
  const [deleteRotinaTarget, setDeleteRotinaTarget] = useState<Rotina | null>(null);
  const [selectedRotinaEvent, setSelectedRotinaEvent] = useState<{ rotina: Rotina; dayIdx: number } | null>(null);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [form, setForm] = useState({
    titulo: '',
    horario: '',
    responsavel_id: '',
    formulario_id: '',
    dias_semana: [] as string[],
    mensagem: '',
    showFormulario: false,
    showMensagem: false,
  });

  const selectedFuncionario = useMemo(() => {
    if (!form.responsavel_id) return null;
    return funcionarios.find((f) => f.id === form.responsavel_id) || null;
  }, [form.responsavel_id, funcionarios]);

  // Brasília time helper
  const getBrasiliaDate = () => {
    const now = new Date();
    const str = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    return new Date(str);
  };

  const [brasiliaTime, setBrasiliaTime] = useState(getBrasiliaDate);

  useEffect(() => {
    const interval = setInterval(() => setBrasiliaTime(getBrasiliaDate()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const today = brasiliaTime;
  const baseDate = useMemo(() => {
    const d = getBrasiliaDate();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);
  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const isCurrentWeek = weekDates.some(d => {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return ds === todayStr;
  });
  const nowHour = today.getHours();
  const nowMinutes = today.getMinutes();
  const todayDayIdx = today.getDay();
  const monthYear = weekDates[3].toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Get all visible activity IDs for this week
  const visibleActivityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const atv of atividades) {
      if (atv.dia_semana !== null || atv.horario !== null || atv.dia_semana === null) {
        ids.add(atv.id);
      }
    }
    return ids;
  }, [atividades]);

  // Map activities to hour/day grid
  const atividadesByHourDay = useMemo(() => {
    const map: Record<string, CronogramaAtividade[]> = {};
    for (const atv of atividades) {
      const hour = parseHour(atv.horario);
      if (hour === null) continue;

      if (atv.dia_semana !== null) {
        const key = `${hour}-${atv.dia_semana}`;
        if (!map[key]) map[key] = [];
        map[key].push(atv);
      } else {
        for (let d = 0; d < 7; d++) {
          const key = `${hour}-${d}`;
          if (!map[key]) map[key] = [];
          map[key].push(atv);
        }
      }
    }
    return map;
  }, [atividades]);

  const atividadesSemHorario = useMemo(() =>
    atividades.filter(a => !a.horario), [atividades]);

  // Clear selection when changing weeks
  useEffect(() => {
    setSelectedIds(new Set());
  }, [weekOffset]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(visibleActivityIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const toggleDiaSemana = (dia: string) => {
    setForm((current) => ({
      ...current,
      dias_semana: current.dias_semana.includes(dia)
        ? current.dias_semana.filter((v) => v !== dia)
        : [...current.dias_semana, dia].sort((a, b) => Number(a) - Number(b)),
    }));
  };

  const handleCreate = () => {
    if (!form.titulo || !unidadeId) return;
    const atividadesParaCriar = form.dias_semana.length
      ? form.dias_semana.map((dia) => ({
          unidade_id: unidadeId,
          titulo: form.titulo,
          horario: form.horario || undefined,
          responsavel_id: form.responsavel_id || undefined,
          formulario_id: form.formulario_id || undefined,
          dia_semana: Number(dia),
          mensagem: form.mensagem || undefined,
        }))
      : [{
          unidade_id: unidadeId,
          titulo: form.titulo,
          horario: form.horario || undefined,
          responsavel_id: form.responsavel_id || undefined,
          formulario_id: form.formulario_id || undefined,
          dia_semana: undefined,
          mensagem: form.mensagem || undefined,
        }];

    createAtividade.mutate(atividadesParaCriar, {
      onSuccess: () => {
        setOpen(false);
        setForm({ titulo: '', horario: '', responsavel_id: '', formulario_id: '', dias_semana: [], mensagem: '', showFormulario: false, showMensagem: false });
      },
    });
  };

  const handleEventClick = (atv: CronogramaAtividade, dayIdx: number) => {
    if (selectionMode) {
      toggleSelection(atv.id);
    } else {
      setSelectedEvent({ atividade: atv, dayIdx });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      if (ids.length === 1) {
        await deleteAtividade.mutateAsync(ids[0]);
      } else {
        await bulkDeleteAtividades.mutateAsync(ids);
      }
      clearSelection();
      setDeleteConfirmOpen(false);
    } catch {
      // toast handled in hook
    }
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
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
        <div className="flex items-center gap-2">
          {!selectionMode ? (
            <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
              <CheckSquare className="w-4 h-4 mr-1" /> Selecionar
            </Button>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedCount > 0 ? `${selectedCount} selecionada${selectedCount > 1 ? 's' : ''}` : 'Clique nos cards'}
              </span>
              <Button variant="outline" size="sm" onClick={selectAll}>
                <CheckCheck className="w-4 h-4 mr-1" /> Todos
              </Button>
              <Button variant="outline" size="sm" disabled={selectedCount === 0} onClick={() => {
                if (selectedCount === 1) {
                  const id = Array.from(selectedIds)[0];
                  const atv = atividades.find(a => a.id === id);
                  if (atv) {
                    setSelectedEvent({ atividade: atv, dayIdx: atv.dia_semana ?? 0 });
                    setEditingEvent(true);
                  }
                } else {
                  setBulkEditOpen(true);
                }
              }}>
                <Pencil className="w-4 h-4 mr-1" /> Editar
              </Button>
              <Button variant="outline" size="sm" disabled={selectedCount === 0} className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            </>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Atividade</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nova Atividade</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Título *</Label>
                  <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Abertura da unidade" />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input type="time" value={form.horario} onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))} />
                </div>
                <div>
                  <Label>Dia da semana</Label>
                  <div className="mt-1 grid grid-cols-7 gap-1.5">
                    {DIAS_SEMANA.map((d, i) => {
                      const isActive = form.dias_semana.includes(String(i));
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleDiaSemana(String(i))}
                          className={`rounded-md border px-1 py-2 text-xs font-medium transition-colors ${
                            isActive
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.dias_semana.length === 0
                      ? 'Nenhum dia selecionado: valerá para todos os dias.'
                      : `Será criada para: ${form.dias_semana.map((dia) => DIAS_SEMANA[Number(dia)]).join(', ')}`}
                  </p>
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Select value={form.responsavel_id} onValueChange={(v) => setForm((f) => ({ ...f, responsavel_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {funcionarios.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}{f.telefone ? ` — ${f.telefone}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedFuncionario && (
                    <div className="mt-1.5 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      <span className="font-medium">{selectedFuncionario.nome}</span>
                      <span className="text-muted-foreground">
                        {selectedFuncionario.telefone
                          ? `— WhatsApp: ${selectedFuncionario.telefone}`
                          : '— Sem WhatsApp cadastrado'}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Ação WhatsApp</Label>
                  <div className="mt-1.5 flex gap-2">
                    <Button type="button" variant={form.formulario_id ? 'default' : 'outline'} size="sm"
                      onClick={() => setForm(f => ({ ...f, showFormulario: true, showMensagem: false }))}
                      className="flex-1 text-xs">
                      <FileText className="w-3.5 h-3.5 mr-1" /> Vincular Formulário
                    </Button>
                    <Button type="button" variant={form.mensagem && !form.formulario_id ? 'default' : 'outline'} size="sm"
                      onClick={() => setForm(f => ({ ...f, showMensagem: true, showFormulario: false, formulario_id: '' }))}
                      className="flex-1 text-xs">
                      <Phone className="w-3.5 h-3.5 mr-1" /> Escrever Mensagem
                    </Button>
                  </div>
                  {form.showFormulario && (
                    <div className="mt-2">
                      <Select value={form.formulario_id} onValueChange={(v) => setForm((f) => ({ ...f, formulario_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecionar formulário" /></SelectTrigger>
                        <SelectContent>
                          {formularios?.map((f) => <SelectItem key={f.id} value={f.id}>{f.titulo}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {form.showMensagem && (
                    <div className="mt-2">
                      <Textarea
                        value={form.mensagem}
                        onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
                        placeholder="Mensagem enviada via WhatsApp..."
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  )}
                </div>
                {(form.formulario_id || form.mensagem) && (
                  <WhatsAppPreview
                    titulo={form.titulo}
                    horario={form.horario}
                    responsavelNome={selectedFuncionario?.nome}
                    formularioTitulo={formularios?.find(f => f.id === form.formulario_id)?.titulo}
                    mensagem={form.mensagem}
                  />
                )}
                <Button onClick={handleCreate} disabled={!form.titulo || createAtividade.isPending} className="w-full">
                  {createAtividade.isPending ? 'Salvando...' : 'Criar Atividade'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar Grid */}
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

        {/* Activities without time */}
        {atividadesSemHorario.length > 0 && (
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/10">
            <div className="p-1 text-[10px] text-muted-foreground text-right pr-2 border-r flex items-center justify-end">
              <Clock className="w-3 h-3" />
            </div>
            {weekDates.map((_, dayIdx) => {
              const items = atividadesSemHorario.filter(a =>
                a.dia_semana === null || a.dia_semana === dayIdx
              );
              return (
                <div key={dayIdx} className="border-r last:border-r-0 p-0.5 min-h-[40px] overflow-hidden">
                  {items.map(atv => (
                    <EventCard
                      key={atv.id}
                      atv={atv}
                      dayIdx={dayIdx}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(atv.id)}
                      onClick={handleEventClick}
                      funcionarios={funcionarios}
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
            <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b last:border-b-0 min-h-[72px]">
              <div className="p-1 text-[11px] text-muted-foreground text-right pr-2 border-r -mt-2">
                {String(hour).padStart(2, '0')}:00
              </div>
              {weekDates.map((date, dayIdx) => {
                const items = atividadesByHourDay[`${hour}-${dayIdx}`] || [];
                const isToday = date.toISOString().split('T')[0] === todayStr;
                return (
                  <div key={dayIdx} className={cn('border-r last:border-r-0 p-0.5 relative overflow-hidden', isToday && 'bg-primary/[0.02]')}>
                    {items.map(atv => (
                      <EventCard
                        key={atv.id}
                        atv={atv}
                        dayIdx={dayIdx}
                        selectionMode={selectionMode}
                        isSelected={selectedIds.has(atv.id)}
                        onClick={handleEventClick}
                        funcionarios={funcionarios}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Current time indicator */}
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

        {/* Event detail popup (only in non-selection mode) */}
        {selectedEvent && !editingEvent && !selectionMode && (
          <CronogramaEventPopup
            atividade={selectedEvent.atividade}
            date={weekDates[selectedEvent.dayIdx]}
            funcionarios={funcionarios}
            formularios={formularios || []}
            onEdit={() => setEditingEvent(true)}
            onDelete={() => {
              deleteAtividade.mutate(selectedEvent.atividade.id);
              setSelectedEvent(null);
            }}
            onClose={() => setSelectedEvent(null)}
          />
        )}

        {/* Edit Dialog (single item) */}
        <Dialog open={editingEvent && !!selectedEvent} onOpenChange={(open) => { if (!open) { setEditingEvent(false); setSelectedEvent(null); } }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Editar Atividade</DialogTitle></DialogHeader>
            {selectedEvent && (
              <AtividadeEditForm
                atividade={selectedEvent.atividade}
                funcionarios={funcionarios}
                formularios={formularios || []}
                onUpdate={(data) => {
                  updateAtividade.mutate({ id: selectedEvent.atividade.id, ...data }, {
                    onSuccess: () => {
                      setEditingEvent(false);
                      setSelectedEvent(null);
                      if (selectionMode) clearSelection();
                    },
                  });
                }}
                onDelete={() => {
                  deleteAtividade.mutate(selectedEvent.atividade.id);
                  setEditingEvent(false);
                  setSelectedEvent(null);
                  if (selectionMode) clearSelection();
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk Edit Dialog */}
        <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar {selectedCount} atividades</DialogTitle>
              <DialogDescription>Preencha apenas os campos que deseja alterar. Campos vazios não serão modificados.</DialogDescription>
            </DialogHeader>
            <BulkEditForm
              funcionarios={funcionarios}
              formularios={formularios || []}
              onSave={async (data) => {
                const ids = Array.from(selectedIds);
                try {
                  await bulkUpdateAtividades.mutateAsync({ ids, data });
                  setBulkEditOpen(false);
                  clearSelection();
                } catch {
                  // toast in hook
                }
              }}
              isPending={bulkUpdateAtividades.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Delete Confirm Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir atividade{selectedCount > 1 ? 's' : ''}?</DialogTitle>
              <DialogDescription>
                {selectedCount === 1
                  ? 'Deseja excluir a atividade selecionada? Esta ação não pode ser desfeita.'
                  : `Deseja excluir as ${selectedCount} atividades selecionadas? Esta ação não pode ser desfeita.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleteAtividade.isPending || bulkDeleteAtividades.isPending}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={handleBulkDelete}
                disabled={deleteAtividade.isPending || bulkDeleteAtividades.isPending}>
                {deleteAtividade.isPending || bulkDeleteAtividades.isPending ? 'Excluindo...' : 'Excluir'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────
function EventCard({ atv, dayIdx, selectionMode, isSelected, onClick, funcionarios, compact }: {
  atv: CronogramaAtividade;
  dayIdx: number;
  selectionMode: boolean;
  isSelected: boolean;
  onClick: (atv: CronogramaAtividade, dayIdx: number) => void;
  funcionarios: Array<{ id: string; nome: string; telefone: string | null }>;
  compact?: boolean;
}) {
  const timeLabel = atv.horario?.substring(0, 5);
  const responsavel = funcionarios.find(f => f.id === atv.responsavel_id);

  return (
    <button
      onClick={() => onClick(atv, dayIdx)}
      className={cn(
        'w-full text-left rounded-md px-1.5 py-1 mb-0.5 text-[11px] leading-tight cursor-pointer transition-all overflow-hidden',
        isSelected
          ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background'
          : 'bg-primary/90 text-primary-foreground hover:opacity-80',
        selectionMode && !isSelected && 'opacity-70'
      )}
    >
      {compact ? (
        <span className="truncate block">{atv.titulo}</span>
      ) : (
        <>
          <span className="font-semibold truncate block">
            {atv.titulo}{responsavel ? ` (${responsavel.nome.split(' ')[0]})` : ''}
          </span>
          {timeLabel && <span className="opacity-80 text-[10px] truncate block">{timeLabel}</span>}
        </>
      )}
      {selectionMode && (
        <span className="absolute top-0.5 right-0.5">
          {isSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 opacity-50" />}
        </span>
      )}
    </button>
  );
}

// ─── Bulk Edit Form ───────────────────────────────────────────
function BulkEditForm({ funcionarios, formularios, onSave, isPending }: {
  funcionarios: Array<{ id: string; nome: string; telefone: string | null }>;
  formularios: Array<{ id: string; titulo: string }>;
  onSave: (data: { titulo?: string; horario?: string | null; responsavel_id?: string | null; formulario_id?: string | null; mensagem?: string | null }) => void;
  isPending: boolean;
}) {
  const [editForm, setEditForm] = useState({
    titulo: '',
    horario: '',
    responsavel_id: '',
    formulario_id: '',
    mensagem: '',
  });

  const handleSave = () => {
    const data: Record<string, string | null> = {};
    if (editForm.titulo) data.titulo = editForm.titulo;
    if (editForm.horario) data.horario = editForm.horario;
    if (editForm.responsavel_id) data.responsavel_id = editForm.responsavel_id;
    if (editForm.formulario_id) data.formulario_id = editForm.formulario_id;
    if (editForm.mensagem) data.mensagem = editForm.mensagem;
    if (Object.keys(data).length === 0) return;
    onSave(data);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Título</Label>
        <Input value={editForm.titulo} onChange={(e) => setEditForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Deixe vazio para manter" />
      </div>
      <div>
        <Label>Horário</Label>
        <Input type="time" value={editForm.horario} onChange={(e) => setEditForm(f => ({ ...f, horario: e.target.value }))} />
      </div>
      <div>
        <Label>Responsável</Label>
        <Select value={editForm.responsavel_id} onValueChange={(v) => setEditForm(f => ({ ...f, responsavel_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Manter atual" /></SelectTrigger>
          <SelectContent>
            {funcionarios.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.nome}{f.telefone ? ` — ${f.telefone}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Formulário</Label>
        <Select value={editForm.formulario_id} onValueChange={(v) => setEditForm(f => ({ ...f, formulario_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Manter atual" /></SelectTrigger>
          <SelectContent>
            {formularios.map((f) => <SelectItem key={f.id} value={f.id}>{f.titulo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Mensagem</Label>
        <Textarea value={editForm.mensagem} onChange={(e) => setEditForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Deixe vazio para manter" rows={3} className="resize-none" />
      </div>
      <Button onClick={handleSave} disabled={isPending} className="w-full">
        {isPending ? 'Salvando...' : 'Salvar Alterações'}
      </Button>
    </div>
  );
}

// ─── Event Popup ──────────────────────────────────────────────
function formatDayOfWeek(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function CronogramaEventPopup({ atividade, date, funcionarios, formularios, onEdit, onDelete, onClose }: {
  atividade: CronogramaAtividade;
  date: Date;
  funcionarios: Array<{ id: string; nome: string; telefone: string | null }>;
  formularios: Array<{ id: string; titulo: string }>;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const timeLabel = atividade.horario?.substring(0, 5);
  const dayLabel = formatDayOfWeek(date);
  const responsavel = funcionarios.find(f => f.id === atividade.responsavel_id);
  const formulario = formularios.find(f => f.id === atividade.formulario_id);

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
        <div className="flex items-center justify-end gap-1 px-3 pt-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-4 h-4 rounded-sm mt-1 shrink-0 bg-primary" />
            <div>
              <h3 className="text-lg font-semibold leading-tight">{atividade.titulo}</h3>
              <p className="text-sm text-muted-foreground capitalize mt-0.5">
                {dayLabel}
                {timeLabel && ` · ${timeLabel}`}
              </p>
            </div>
          </div>
          {responsavel && (
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm">{responsavel.nome}</span>
              {responsavel.telefone && (
                <span className="text-xs text-muted-foreground ml-auto">{responsavel.telefone}</span>
              )}
            </div>
          )}
          {formulario && (
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Formulário: {formulario.titulo}</span>
            </div>
          )}
          {atividade.mensagem && (
            <div className="flex items-start gap-3">
              <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{atividade.mensagem}</p>
            </div>
          )}
          {atividade.dia_semana !== null && (
            <div className="flex items-center gap-3">
              <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                {DIAS_SEMANA[atividade.dia_semana]}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Single Edit Form ─────────────────────────────────────────
function AtividadeEditForm({ atividade, funcionarios, formularios, onUpdate, onDelete }: {
  atividade: CronogramaAtividade;
  funcionarios: Array<{ id: string; nome: string; telefone: string | null }>;
  formularios: Array<{ id: string; titulo: string }>;
  onUpdate: (data: { titulo?: string; horario?: string | null; responsavel_id?: string | null; formulario_id?: string | null; dia_semana?: number | null; mensagem?: string | null }) => void;
  onDelete: () => void;
}) {
  const [editForm, setEditForm] = useState({
    titulo: atividade.titulo,
    horario: atividade.horario?.substring(0, 5) || '',
    responsavel_id: atividade.responsavel_id || '',
    formulario_id: atividade.formulario_id || '',
    dia_semana: atividade.dia_semana,
    mensagem: atividade.mensagem || '',
  });
  const [showSection, setShowSection] = useState<'formulario' | 'mensagem' | null>(
    atividade.formulario_id ? 'formulario' : atividade.mensagem ? 'mensagem' : null
  );

  const selectedFuncionario = useMemo(() => {
    if (!editForm.responsavel_id) return null;
    return funcionarios.find((f) => f.id === editForm.responsavel_id) || null;
  }, [editForm.responsavel_id, funcionarios]);

  const handleSave = () => {
    onUpdate({
      titulo: editForm.titulo,
      horario: editForm.horario || null,
      responsavel_id: editForm.responsavel_id || null,
      formulario_id: editForm.formulario_id || null,
      dia_semana: editForm.dia_semana,
      mensagem: editForm.mensagem || null,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Título *</Label>
        <Input value={editForm.titulo} onChange={(e) => setEditForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Abertura da unidade" />
      </div>
      <div>
        <Label>Horário</Label>
        <Input type="time" value={editForm.horario} onChange={(e) => setEditForm(f => ({ ...f, horario: e.target.value }))} />
      </div>
      <div>
        <Label>Dia da semana</Label>
        <div className="mt-1 grid grid-cols-7 gap-1.5">
          {DIAS_SEMANA.map((d, i) => {
            const isActive = editForm.dia_semana === i;
            return (
              <button key={i} type="button"
                onClick={() => setEditForm(f => ({ ...f, dia_semana: f.dia_semana === i ? null : i }))}
                className={`rounded-md border px-1 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}>
                {d}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {editForm.dia_semana === null ? 'Nenhum dia selecionado: valerá para todos os dias.' : `Apenas: ${DIAS_SEMANA[editForm.dia_semana]}`}
        </p>
      </div>
      <div>
        <Label>Responsável</Label>
        <Select value={editForm.responsavel_id} onValueChange={(v) => setEditForm(f => ({ ...f, responsavel_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>
            {funcionarios.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.nome}{f.telefone ? ` — ${f.telefone}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedFuncionario && (
          <div className="mt-1.5 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs">
            <Phone className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">{selectedFuncionario.nome}</span>
            <span className="text-muted-foreground">
              {selectedFuncionario.telefone
                ? `— WhatsApp: ${selectedFuncionario.telefone}`
                : '— Sem WhatsApp cadastrado'}
            </span>
          </div>
        )}
      </div>
      <div>
        <Label>Ação WhatsApp</Label>
        <div className="mt-1.5 flex gap-2">
          <Button type="button" variant={showSection === 'formulario' ? 'default' : 'outline'} size="sm"
            onClick={() => setShowSection(s => s === 'formulario' ? null : 'formulario')}
            className="flex-1 text-xs">
            <FileText className="w-3.5 h-3.5 mr-1" /> Vincular Formulário
          </Button>
          <Button type="button" variant={showSection === 'mensagem' ? 'default' : 'outline'} size="sm"
            onClick={() => { setShowSection(s => s === 'mensagem' ? null : 'mensagem'); setEditForm(f => ({ ...f, formulario_id: '' })); }}
            className="flex-1 text-xs">
            <Phone className="w-3.5 h-3.5 mr-1" /> Escrever Mensagem
          </Button>
        </div>
        {showSection === 'formulario' && (
          <div className="mt-2">
            <Select value={editForm.formulario_id} onValueChange={(v) => setEditForm(f => ({ ...f, formulario_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar formulário" /></SelectTrigger>
              <SelectContent>
                {formularios.map((f) => <SelectItem key={f.id} value={f.id}>{f.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {showSection === 'mensagem' && (
          <div className="mt-2">
            <Textarea
              value={editForm.mensagem}
              onChange={(e) => setEditForm(f => ({ ...f, mensagem: e.target.value }))}
              placeholder="Mensagem enviada via WhatsApp..."
              rows={3}
              className="resize-none"
            />
          </div>
        )}
        {(editForm.formulario_id || editForm.mensagem) && (
          <WhatsAppPreview
            titulo={editForm.titulo}
            horario={editForm.horario}
            responsavelNome={selectedFuncionario?.nome}
            formularioTitulo={formularios.find(f => f.id === editForm.formulario_id)?.titulo}
            mensagem={editForm.mensagem}
          />
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={!editForm.titulo} className="flex-1">
          Salvar Alterações
        </Button>
        <Button variant="destructive" onClick={onDelete} size="icon">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── WhatsApp Preview ─────────────────────────────────────────
function WhatsAppPreview({ titulo, horario, responsavelNome, formularioTitulo, mensagem }: {
  titulo: string;
  horario: string;
  responsavelNome?: string;
  formularioTitulo?: string;
  mensagem: string;
}) {
  const lines: string[] = [];
  lines.push(`📋 *${titulo || 'Atividade'}*`);
  if (horario) lines.push(`⏰ Horário: ${horario}`);
  if (responsavelNome) lines.push(`👤 Responsável: ${responsavelNome}`);
  if (mensagem) {
    lines.push('');
    lines.push(mensagem);
  }
  if (formularioTitulo) {
    lines.push('');
    lines.push(`📝 Formulário: *${formularioTitulo}*`);
    lines.push('🔗 https://app.exemplo.com/formulario/...');
  }

  const preview = lines.join('\n');

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-3 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <Phone className="w-3.5 h-3.5 text-green-600" />
        <span className="text-xs font-medium text-muted-foreground">Prévia da mensagem WhatsApp</span>
      </div>
      <div className="rounded-lg bg-[#dcf8c6] dark:bg-[#025c4c] px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground">
        {preview}
      </div>
    </div>
  );
}
