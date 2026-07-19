import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Pencil, Search, X } from 'lucide-react';
import type { CronogramaAtividadeAdmin } from '@/hooks/useCronogramaAdmin';
import { DIAS_SEMANA } from '@/lib/cronUtils';
import { labelTipo } from '@/lib/cronogramaTipos';
import type { BulkField } from './BulkEditDialog';

interface Props {
  atividades: CronogramaAtividadeAdmin[];
  selected: Set<string>;
  setSelected: (fn: (s: Set<string>) => Set<string>) => void;
  onEditSingle: (a: CronogramaAtividadeAdmin) => void;
  onToggleAtivo: (a: CronogramaAtividadeAdmin, v: boolean) => void;
  onOpenBulk: (f: BulkField) => void;
}

type OrderKey = 'nome' | 'total' | 'horario' | 'ativas' | 'pausadas';

export function AtividadesPorTipo({ atividades, selected, setSelected, onEditSingle, onToggleAtivo, onOpenBulk }: Props) {
  const [search, setSearch] = useState('');
  const [fUnidade, setFUnidade] = useState<string>('all');
  const [fResp, setFResp] = useState<string>('all');
  const [fDia, setFDia] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');
  const [fTurno, setFTurno] = useState<string>('all');
  const [hFrom, setHFrom] = useState('');
  const [hTo, setHTo] = useState('');
  const [order, setOrder] = useState<OrderKey>('nome');

  const unidadesOpts = useMemo(() => Array.from(new Map(atividades.map(a => [a.unidade_id, a.unidades?.nome || '—'])).entries()), [atividades]);
  const respOpts = useMemo(() => Array.from(new Set(atividades.map(a => a.cronograma_funcionarios?.nome).filter(Boolean))) as string[], [atividades]);
  const turnoOpts = useMemo(() => Array.from(new Set(atividades.map(a => a.turno).filter(Boolean))) as string[], [atividades]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return atividades.filter(a => {
      if (s && !(a.titulo?.toLowerCase().includes(s) || a.tipo_atividade?.toLowerCase().includes(s) || a.cronograma_funcionarios?.nome?.toLowerCase().includes(s))) return false;
      if (fUnidade !== 'all' && a.unidade_id !== fUnidade) return false;
      if (fResp !== 'all' && a.cronograma_funcionarios?.nome !== fResp) return false;
      if (fDia !== 'all' && String(a.dia_semana) !== fDia) return false;
      if (fStatus === 'ativa' && !a.ativo) return false;
      if (fStatus === 'pausada' && a.ativo) return false;
      if (fTurno !== 'all' && a.turno !== fTurno) return false;
      if (hFrom && (!a.horario || a.horario < `${hFrom}:00`)) return false;
      if (hTo && (!a.horario || a.horario > `${hTo}:59`)) return false;
      return true;
    });
  }, [atividades, search, fUnidade, fResp, fDia, fStatus, fTurno, hFrom, hTo]);

  const grupos = useMemo(() => {
    const map = new Map<string, CronogramaAtividadeAdmin[]>();
    for (const a of filtered) {
      const k = a.tipo_atividade || 'SEM TIPO';
      const arr = map.get(k) || [];
      arr.push(a);
      map.set(k, arr);
    }
    const list = Array.from(map.entries()).map(([tipo, itens]) => ({
      tipo,
      itens,
      ativas: itens.filter(i => i.ativo).length,
      pausadas: itens.filter(i => !i.ativo).length,
      unidades: Array.from(new Set(itens.map(i => i.unidades?.nome).filter(Boolean))) as string[],
    }));
    list.sort((a, b) => {
      switch (order) {
        case 'total': return b.itens.length - a.itens.length;
        case 'ativas': return b.ativas - a.ativas;
        case 'pausadas': return b.pausadas - a.pausadas;
        case 'horario': {
          const ah = a.itens[0]?.horario || '';
          const bh = b.itens[0]?.horario || '';
          return ah.localeCompare(bh);
        }
        default: return labelTipo(a.tipo).localeCompare(labelTipo(b.tipo));
      }
    });
    return list;
  }, [filtered, order]);

  // Detectar duplicidades
  const dupSet = useMemo(() => {
    const s = new Set<string>();
    const map = new Map<string, string[]>();
    for (const a of atividades) {
      if (!a.ativo) continue;
      const key = `${a.tipo_atividade}|${a.unidade_id}|${a.responsavel_id}|${a.dia_semana}|${a.horario}|${a.turno}`;
      const arr = map.get(key) || [];
      arr.push(a.id);
      map.set(key, arr);
    }
    for (const arr of map.values()) if (arr.length > 1) arr.forEach(id => s.add(id));
    return s;
  }, [atividades]);

  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const setMany = (ids: string[], on: boolean) => setSelected(prev => {
    const next = new Set(prev);
    ids.forEach(id => on ? next.add(id) : next.delete(id));
    return next;
  });

  const clearFilters = () => {
    setSearch(''); setFUnidade('all'); setFResp('all'); setFDia('all'); setFStatus('all'); setFTurno('all'); setHFrom(''); setHTo('');
  };

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-7 h-8" placeholder="Buscar atividade, título ou responsável" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={fUnidade} onValueChange={setFUnidade}>
              <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas unidades</SelectItem>
                {unidadesOpts.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fResp} onValueChange={setFResp}>
              <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                {respOpts.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fDia} onValueChange={setFDia}>
              <SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="Dia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos dias</SelectItem>
                {DIAS_SEMANA.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativa">Ativas</SelectItem>
                <SelectItem value="pausada">Pausadas</SelectItem>
              </SelectContent>
            </Select>
            {turnoOpts.length > 0 && (
              <Select value={fTurno} onValueChange={setFTurno}>
                <SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="Turno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos turnos</SelectItem>
                  {turnoOpts.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Input type="time" className="w-[110px] h-8" value={hFrom} onChange={e => setHFrom(e.target.value)} placeholder="De" />
            <Input type="time" className="w-[110px] h-8" value={hTo} onChange={e => setHTo(e.target.value)} placeholder="Até" />
            <Select value={order} onValueChange={(v: any) => setOrder(v)}>
              <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Ordenar: Nome</SelectItem>
                <SelectItem value="total">Ordenar: Qtd total</SelectItem>
                <SelectItem value="horario">Ordenar: Horário</SelectItem>
                <SelectItem value="ativas">Ordenar: Ativas</SelectItem>
                <SelectItem value="pausadas">Ordenar: Pausadas</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accordion */}
      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade encontrada.</p>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {grupos.map(g => {
            const ids = g.itens.map(i => i.id);
            const selInGroup = ids.filter(id => selected.has(id)).length;
            const allSel = selInGroup === ids.length;
            const someSel = selInGroup > 0 && !allSel;
            return (
              <AccordionItem key={g.tipo} value={g.tipo} className="border rounded-md">
                <div className="flex items-center gap-2 pr-3">
                  <div className="pl-3" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={allSel ? true : someSel ? 'indeterminate' as any : false}
                      onCheckedChange={(v: any) => setMany(ids, !!v)}
                    />
                  </div>
                  <AccordionTrigger className="flex-1 hover:no-underline py-2.5">
                    <div className="flex items-center gap-3 flex-wrap text-left">
                      <span className="font-semibold text-sm">{labelTipo(g.tipo)}</span>
                      <Badge variant="secondary" className="text-xs">{g.itens.length} automações</Badge>
                      <span className="text-xs text-muted-foreground">
                        {g.ativas} ativas · {g.pausadas} pausadas
                      </span>
                      {g.unidades.length > 0 && (
                        <span className="text-xs text-muted-foreground">· {g.unidades.join(', ')}</span>
                      )}
                    </div>
                  </AccordionTrigger>
                </div>
                <AccordionContent className="pt-0">
                  {/* Atalhos */}
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2 border-b">
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setMany(ids, true)}>Todos</Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setMany(g.itens.filter(i => i.dia_semana != null && i.dia_semana >= 1 && i.dia_semana <= 5).map(i => i.id), true)}>Seg–Sex</Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setMany(g.itens.filter(i => i.dia_semana === 0 || i.dia_semana === 6).map(i => i.id), true)}>Fim de semana</Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setMany(g.itens.filter(i => i.ativo).map(i => i.id), true)}>Apenas ativas</Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setMany(g.itens.filter(i => !i.ativo).map(i => i.id), true)}>Apenas pausadas</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setMany(ids, false)}>Limpar</Button>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="w-8"></th>
                        <th className="text-left px-2 py-1.5">Horário</th>
                        <th className="text-left px-2 py-1.5">Responsável</th>
                        <th className="text-left px-2 py-1.5">Unidade</th>
                        <th className="text-left px-2 py-1.5">Turno</th>
                        <th className="text-left px-2 py-1.5">Status</th>
                        <th className="text-right px-2 py-1.5">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.itens.map(a => (
                        <tr key={a.id} className="border-t hover:bg-muted/30">
                          <td className="px-2 py-1.5"><Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleOne(a.id)} /></td>
                          
                          <td className="px-2 py-1.5 text-xs">{a.horario?.slice(0, 5) || '—'}</td>
                          <td className="px-2 py-1.5 text-xs">{a.cronograma_funcionarios?.nome || '—'}</td>
                          <td className="px-2 py-1.5 text-xs">{a.unidades?.nome || '—'}</td>
                          <td className="px-2 py-1.5 text-xs">{a.turno || '—'}</td>
                          <td className="px-2 py-1.5 text-xs">
                            <div className="flex items-center gap-2">
                              <Switch checked={a.ativo} onCheckedChange={(v) => onToggleAtivo(a, v)} />
                              {dupSet.has(a.id) && (
                                <span className="inline-flex items-center gap-1 text-amber-600 text-[10px]" title="Possível automação duplicada">
                                  <AlertTriangle className="w-3 h-3" /> dup
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onEditSingle(a)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
