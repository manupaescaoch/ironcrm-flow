import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useCronogramaFuncionarios } from '@/hooks/useCronogramaFuncionarios';
import { useUnidadeUsers } from '@/hooks/useUnidadeUsers';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2 } from 'lucide-react';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface SourceAtividade {
  id: string;
  titulo: string;
  horario: string | null;
  dia_semana: number | null;
  mensagem: string | null;
  formulario_id: string | null;
  responsavel_id: string | null;
  responsavel_nome?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ReplicarCronogramaModal({ open, onOpenChange }: Props) {
  const { unidadeAtual, unidadesPermitidas } = useUnidade();
  const { ativos: funcionariosDestino } = useCronogramaFuncionarios();
  const { users: usersDestino } = useUnidadeUsers();
  const queryClient = useQueryClient();

  const [sourceUnidadeId, setSourceUnidadeId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [atividades, setAtividades] = useState<SourceAtividade[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [responsavelMap, setResponsavelMap] = useState<Record<string, string>>({});

  const outrasUnidades = useMemo(
    () => unidadesPermitidas.filter(u => u.id !== unidadeAtual?.id),
    [unidadesPermitidas, unidadeAtual]
  );

  const responsaveisDestino = useMemo(() => {
    const funcIds = new Set(funcionariosDestino.map(f => f.id));
    const fromUsers = usersDestino
      .filter(u => !funcIds.has(u.id))
      .map(u => ({ id: u.id, nome: u.name, group: 'Usuários' as const }));
    const funcs = funcionariosDestino.map(f => ({ id: f.id, nome: f.nome, group: 'Equipe' as const }));
    return [...funcs, ...fromUsers];
  }, [funcionariosDestino, usersDestino]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSourceUnidadeId('');
      setAtividades([]);
      setSelected(new Set());
      setResponsavelMap({});
    }
  }, [open]);

  // Load source activities
  useEffect(() => {
    if (!sourceUnidadeId) return;
    setLoading(true);
    supabase
      .from('cronograma_atividades')
      .select('id, titulo, horario, dia_semana, mensagem, formulario_id, responsavel_id, cronograma_funcionarios(nome)')
      .eq('unidade_id', sourceUnidadeId)
      .eq('ativo', true)
      .order('horario')
      .then(({ data, error }) => {
        if (error) {
          toast({ title: 'Erro ao carregar atividades', variant: 'destructive' });
          setAtividades([]);
        } else {
          const list: SourceAtividade[] = (data || []).map((a: any) => ({
            id: a.id,
            titulo: a.titulo,
            horario: a.horario,
            dia_semana: a.dia_semana,
            mensagem: a.mensagem,
            formulario_id: a.formulario_id,
            responsavel_id: a.responsavel_id,
            responsavel_nome: a.cronograma_funcionarios?.nome ?? null,
          }));
          setAtividades(list);
          setSelected(new Set(list.map(a => a.id)));

          // Auto-map responsaveis by name match
          const map: Record<string, string> = {};
          for (const a of list) {
            if (a.responsavel_nome) {
              const match = responsaveisDestino.find(
                r => r.nome.trim().toUpperCase() === a.responsavel_nome!.trim().toUpperCase()
              );
              if (match && a.responsavel_id) map[a.responsavel_id] = match.id;
            }
          }
          setResponsavelMap(map);
        }
        setLoading(false);
      });
  }, [sourceUnidadeId, responsaveisDestino]);

  const uniqueResponsaveisOrigem = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of atividades) {
      if (a.responsavel_id && a.responsavel_nome && !seen.has(a.responsavel_id)) {
        seen.set(a.responsavel_id, a.responsavel_nome);
      }
    }
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome }));
  }, [atividades]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === atividades.length) setSelected(new Set());
    else setSelected(new Set(atividades.map(a => a.id)));
  };

  const handleReplicate = async () => {
    if (!unidadeAtual || selected.size === 0) return;
    setSaving(true);
    try {
      const payload = atividades
        .filter(a => selected.has(a.id))
        .map(a => ({
          unidade_id: unidadeAtual.id,
          titulo: a.titulo,
          horario: a.horario,
          dia_semana: a.dia_semana,
          mensagem: a.mensagem,
          formulario_id: a.formulario_id,
          responsavel_id: a.responsavel_id ? (responsavelMap[a.responsavel_id] || null) : null,
        }));
      const { error } = await supabase.from('cronograma_atividades').insert(payload);
      if (error) throw error;
      toast({ title: `${payload.length} atividade(s) replicada(s) com sucesso` });
      queryClient.invalidateQueries({ queryKey: ['cronograma-atividades'] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao replicar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" /> Replicar Cronograma de Outra Unidade
          </DialogTitle>
          <DialogDescription>
            Copie atividades de outra unidade para <strong>{unidadeAtual?.nome}</strong>. Selecione quais replicar e mapeie os responsáveis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Unidade de origem</Label>
            <Select value={sourceUnidadeId} onValueChange={setSourceUnidadeId}>
              <SelectTrigger><SelectValue placeholder="Escolha a unidade para copiar" /></SelectTrigger>
              <SelectContent>
                {outrasUnidades.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && <Skeleton className="h-40" />}

          {!loading && sourceUnidadeId && atividades.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma atividade ativa nessa unidade.
            </p>
          )}

          {!loading && atividades.length > 0 && (
            <>
              {uniqueResponsaveisOrigem.length > 0 && (
                <div className="border rounded-md p-3 space-y-2 bg-muted/30">
                  <Label className="text-sm font-semibold">Mapear Responsáveis</Label>
                  <p className="text-xs text-muted-foreground">
                    Para cada responsável da unidade de origem, escolha o equivalente em {unidadeAtual?.nome}. Deixe em branco para criar sem responsável.
                  </p>
                  {uniqueResponsaveisOrigem.map(r => (
                    <div key={r.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="text-sm font-medium truncate">{r.nome}</div>
                      <span className="text-muted-foreground text-xs">→</span>
                      <Select
                        value={responsavelMap[r.id] || 'none'}
                        onValueChange={v => setResponsavelMap(m => ({ ...m, [r.id]: v === 'none' ? '' : v }))}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Sem responsável —</SelectItem>
                          {responsaveisDestino.map(d => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.nome} <span className="text-muted-foreground text-xs ml-1">({d.group})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Atividades ({selected.size}/{atividades.length})</Label>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selected.size === atividades.length ? 'Desmarcar todas' : 'Marcar todas'}
                </Button>
              </div>

              <ScrollArea className="h-64 border rounded-md">
                <div className="p-2 space-y-1">
                  {atividades.map(a => (
                    <label
                      key={a.id}
                      className="flex items-start gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.has(a.id)}
                        onCheckedChange={() => toggle(a.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{a.titulo}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {a.horario && <Badge variant="outline" className="text-xs">{a.horario.slice(0, 5)}</Badge>}
                          <Badge variant="secondary" className="text-xs">
                            {a.dia_semana !== null ? DIAS[a.dia_semana] : 'Todo dia'}
                          </Badge>
                          {a.responsavel_nome && (
                            <Badge variant="outline" className="text-xs">{a.responsavel_nome}</Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleReplicate} disabled={saving || selected.size === 0}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Replicar {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
