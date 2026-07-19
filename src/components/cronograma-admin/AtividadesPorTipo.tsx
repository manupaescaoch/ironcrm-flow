import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Search, X, Trash2 } from 'lucide-react';
import type { CronogramaAtividadeAdmin } from '@/hooks/useCronogramaAdmin';
import { DIAS_LABEL_SHORT, TIPO_DISPLAY_LABEL, TIPO_DISPLAY_ORDER, classifyDisplay, type TipoDisplay } from '@/lib/cronogramaTipos';

export interface GrupoConjunto {
  key: string;
  titulo: string;
  horario: string | null;
  responsavel_id: string | null;
  responsavel_nome: string;
  unidade_id: string;
  unidade_nome: string;
  dias: number[];             // dias com pelo menos um registro
  diasAtivos: number[];       // dias ativos
  ids: string[];              // todos os ids do conjunto
  ativoAll: boolean;
  ativoAny: boolean;
  itens: CronogramaAtividadeAdmin[];
}

interface Props {
  atividades: CronogramaAtividadeAdmin[];
  selected: Set<string>;
  setSelected: (fn: (s: Set<string>) => Set<string>) => void;
  onEditGrupo: (g: GrupoConjunto) => void;
  onToggleGrupo: (g: GrupoConjunto, v: boolean) => void;
  onDeleteGrupo: (g: GrupoConjunto) => void;
}

export function AtividadesPorTipo({ atividades, selected, setSelected, onEditGrupo, onToggleGrupo, onDeleteGrupo }: Props) {
  const [search, setSearch] = useState('');
  const [fUnidade, setFUnidade] = useState<string>('all');
  const [fResp, setFResp] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');
  const [hFrom, setHFrom] = useState('');
  const [hTo, setHTo] = useState('');

  const unidadesOpts = useMemo(
    () => Array.from(new Map(atividades.map(a => [a.unidade_id, a.unidades?.nome || '—'])).entries()),
    [atividades]
  );
  const respOpts = useMemo(
    () => Array.from(new Set(atividades.map(a => a.cronograma_funcionarios?.nome).filter(Boolean))) as string[],
    [atividades]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return atividades.filter(a => {
      if (s && !(
        a.titulo?.toLowerCase().includes(s) ||
        a.cronograma_funcionarios?.nome?.toLowerCase().includes(s) ||
        a.unidades?.nome?.toLowerCase().includes(s)
      )) return false;
      if (fUnidade !== 'all' && a.unidade_id !== fUnidade) return false;
      if (fResp !== 'all' && a.cronograma_funcionarios?.nome !== fResp) return false;
      if (fStatus === 'ativa' && !a.ativo) return false;
      if (fStatus === 'pausada' && a.ativo) return false;
      if (hFrom && (!a.horario || a.horario < `${hFrom}:00`)) return false;
      if (hTo && (!a.horario || a.horario > `${hTo}:59`)) return false;
      return true;
    });
  }, [atividades, search, fUnidade, fResp, fStatus, hFrom, hTo]);

  // Nível 1: tipo display, Nível 2: (titulo|horario|responsavel|unidade)
  const grupos = useMemo(() => {
    const porTipo = new Map<TipoDisplay, Map<string, GrupoConjunto>>();
    for (const a of filtered) {
      const td = classifyDisplay(a);
      const tipoMap = porTipo.get(td) || new Map<string, GrupoConjunto>();
      const key = `${a.titulo}|${a.horario || ''}|${a.responsavel_id || ''}|${a.unidade_id}`;
      const existing = tipoMap.get(key);
      if (existing) {
        existing.itens.push(a);
        existing.ids.push(a.id);
        if (a.dia_semana != null) existing.dias.push(a.dia_semana);
        if (a.ativo && a.dia_semana != null) existing.diasAtivos.push(a.dia_semana);
        existing.ativoAll = existing.ativoAll && a.ativo;
        existing.ativoAny = existing.ativoAny || a.ativo;
      } else {
        tipoMap.set(key, {
          key,
          titulo: a.titulo,
          horario: a.horario,
          responsavel_id: a.responsavel_id,
          responsavel_nome: a.cronograma_funcionarios?.nome || '—',
          unidade_id: a.unidade_id,
          unidade_nome: a.unidades?.nome || '—',
          dias: a.dia_semana != null ? [a.dia_semana] : [],
          diasAtivos: a.ativo && a.dia_semana != null ? [a.dia_semana] : [],
          ids: [a.id],
          ativoAll: a.ativo,
          ativoAny: a.ativo,
          itens: [a],
        });
      }
      porTipo.set(td, tipoMap);
    }
    // Ordenar por horario dentro de cada tipo
    return TIPO_DISPLAY_ORDER
      .map(td => {
        const conjuntos = Array.from((porTipo.get(td) || new Map()).values())
          .sort((a, b) => (a.horario || '').localeCompare(b.horario || '') || a.responsavel_nome.localeCompare(b.responsavel_nome));
        return { td, label: TIPO_DISPLAY_LABEL[td], conjuntos };
      })
      .filter(g => g.conjuntos.length > 0);
  }, [filtered]);

  const toggleGroupSel = (ids: string[], on: boolean) => setSelected(prev => {
    const next = new Set(prev);
    ids.forEach(id => on ? next.add(id) : next.delete(id));
    return next;
  });

  const clearFilters = () => {
    setSearch(''); setFUnidade('all'); setFResp('all'); setFStatus('all'); setHFrom(''); setHTo('');
  };

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-7 h-8" placeholder="Buscar título, responsável ou unidade" value={search} onChange={e => setSearch(e.target.value)} />
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
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ativa">Ativas</SelectItem>
                <SelectItem value="pausada">Pausadas</SelectItem>
              </SelectContent>
            </Select>
            <Input type="time" className="w-[110px] h-8" value={hFrom} onChange={e => setHFrom(e.target.value)} placeholder="De" />
            <Input type="time" className="w-[110px] h-8" value={hTo} onChange={e => setHTo(e.target.value)} placeholder="Até" />
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade encontrada.</p>
      ) : (
        <Accordion type="multiple" defaultValue={grupos.map(g => g.td)} className="space-y-2">
          {grupos.map(g => {
            const totalIds = g.conjuntos.flatMap(c => c.ids);
            const ativos = g.conjuntos.reduce((s, c) => s + c.itens.filter(i => i.ativo).length, 0);
            const pausados = totalIds.length - ativos;
            return (
              <AccordionItem key={g.td} value={g.td} className="border rounded-md">
                <AccordionTrigger className="hover:no-underline py-2.5 px-3">
                  <div className="flex items-center gap-3 flex-wrap text-left">
                    <span className="font-semibold text-sm">{g.label}</span>
                    <Badge variant="secondary" className="text-xs">{g.conjuntos.length} horários</Badge>
                    <span className="text-xs text-muted-foreground">
                      {ativos} envios ativos · {pausados} pausados
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="w-8"></th>
                        <th className="text-left px-2 py-1.5">Horário</th>
                        <th className="text-left px-2 py-1.5">Responsável</th>
                        <th className="text-left px-2 py-1.5">Unidade</th>
                        <th className="text-left px-2 py-1.5">Dias da semana</th>
                        <th className="text-left px-2 py-1.5">Status</th>
                        <th className="text-right px-2 py-1.5">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.conjuntos.map(c => {
                        const allSel = c.ids.every(id => selected.has(id));
                        const someSel = !allSel && c.ids.some(id => selected.has(id));
                        return (
                          <tr key={c.key} className="border-t hover:bg-muted/30">
                            <td className="px-2 py-1.5">
                              <Checkbox
                                checked={allSel ? true : someSel ? ('indeterminate' as any) : false}
                                onCheckedChange={(v: any) => toggleGroupSel(c.ids, !!v)}
                              />
                            </td>
                            <td className="px-2 py-1.5 text-xs font-medium">{c.horario?.slice(0, 5) || '—'}</td>
                            <td className="px-2 py-1.5 text-xs">{c.responsavel_nome}</td>
                            <td className="px-2 py-1.5 text-xs">{c.unidade_nome}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex flex-wrap gap-1">
                                {DIAS_LABEL_SHORT.map((lbl, idx) => {
                                  const on = c.diasAtivos.includes(idx);
                                  const present = c.dias.includes(idx);
                                  return (
                                    <span
                                      key={idx}
                                      className={
                                        'text-[10px] px-1.5 py-0.5 rounded border ' +
                                        (on
                                          ? 'bg-primary text-primary-foreground border-primary'
                                          : present
                                          ? 'bg-muted text-muted-foreground border-muted'
                                          : 'bg-transparent text-muted-foreground/40 border-dashed')
                                      }
                                      title={on ? 'Ativo' : present ? 'Pausado' : 'Não cadastrado'}
                                    >
                                      {lbl}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-xs">
                              <Switch checked={c.ativoAll} onCheckedChange={(v) => onToggleGrupo(c, v)} />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Editar" onClick={() => onEditGrupo(c)}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  title="Excluir"
                                  onClick={() => {
                                    if (confirm(`Excluir ${c.ids.length} envio(s) deste conjunto?`)) onDeleteGrupo(c);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
