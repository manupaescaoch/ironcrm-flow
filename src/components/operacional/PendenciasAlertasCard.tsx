import { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, ExternalLink } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CATEGORIAS, GRAVIDADE_LABEL, PendenciaItem, STATUS_LABEL, parseISODate } from '@/lib/operacionalDashboard';

const statusVariant: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  em_andamento: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  resolvido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  vencido: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

export function PendenciasAlertasCard({ pendencias }: { pendencias: PendenciaItem[] }) {
  const [statusFiltro, setStatusFiltro] = useState('abertas');
  const [categoria, setCategoria] = useState('all');
  const [sel, setSel] = useState<PendenciaItem | null>(null);
  const [form, setForm] = useState({ responsavel: '', prazo: '', status: 'pendente', solucao: '' });
  const { toast } = useToast();
  const qc = useQueryClient();

  const lista = useMemo(
    () =>
      pendencias
        .filter((p) => (statusFiltro === 'abertas' ? p.status !== 'resolvido' : statusFiltro === 'all' ? true : p.status === statusFiltro))
        .filter((p) => categoria === 'all' || p.categoria === categoria)
        .sort((a, b) => (a.data < b.data ? 1 : -1)),
    [pendencias, statusFiltro, categoria],
  );

  const salvar = useMutation({
    mutationFn: async () => {
      if (!sel) return;
      const payload = {
        source_tabela: sel.source_tabela,
        source_id: sel.source_tabela === 'formulario_previsto' ? crypto.randomUUID() : sel.source_id,
        unidade: sel.unidade,
        data: sel.data,
        turno: sel.turno,
        registrado_por: sel.registrado_por,
        categoria: sel.categoria,
        descricao: sel.descricao,
        gravidade: sel.gravidade,
        responsavel_solucao: form.responsavel || null,
        prazo: form.prazo || null,
        status: form.status,
        solucao: form.solucao || null,
      };
      if (sel.trackingId) {
        const { error } = await supabase
          .from('operacional_pendencias')
          .update({
            responsavel_solucao: payload.responsavel_solucao,
            prazo: payload.prazo,
            status: payload.status,
            solucao: payload.solucao,
          })
          .eq('id', sel.trackingId);
        if (error) throw error;
      } else if (sel.source_tabela === 'formulario_previsto') {
        toast({ title: 'Registro informativo', description: 'Formulários não preenchidos não geram pendência editável.' });
        return;
      } else {
        const { error } = await supabase.from('operacional_pendencias').upsert(payload, { onConflict: 'source_tabela,source_id,categoria' });
        if (error) throw error;
      }
      toast({ title: 'Pendência atualizada' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operacional-dashboard-raw'] });
      setSel(null);
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const abrir = (p: PendenciaItem) => {
    setSel(p);
    setForm({ responsavel: p.responsavel_solucao ?? '', prazo: p.prazo ?? '', status: p.status === 'vencido' ? 'pendente' : p.status, solucao: p.solucao ?? '' });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Pendências e alertas ({lista.length})
            </CardTitle>
            <div className="flex gap-2">
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="abertas">Em aberto</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Nenhuma pendência registrada com os filtros atuais.</p>
          ) : (
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Unidade', 'Data', 'Turno', 'Registro', 'Categoria', 'Descrição', 'Gravidade', 'Responsável', 'Prazo', 'Status', 'Ação'].map((h) => (
                      <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((p) => (
                    <TableRow key={p.key}>
                      <TableCell className="text-xs whitespace-nowrap">{p.unidade}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{format(parseISODate(p.data), 'dd/MM/yy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{p.turno ?? '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{p.registrado_por ?? '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{p.categoria}</TableCell>
                      <TableCell className="text-xs max-w-[280px] truncate" title={p.descricao}>{p.descricao}</TableCell>
                      <TableCell className="text-xs">{GRAVIDADE_LABEL[p.gravidade]}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{p.responsavel_solucao ?? '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{p.prazo ? format(parseISODate(p.prazo), 'dd/MM/yy') : '—'}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${statusVariant[p.status]}`} variant="outline">{STATUS_LABEL[p.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => abrir(p)}>Detalhes</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="w-4 h-4" /> {sel?.categoria}
            </DialogTitle>
          </DialogHeader>
          {sel && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-muted/50 p-2 text-xs space-y-1">
                <p><span className="text-muted-foreground">Unidade:</span> {sel.unidade}</p>
                <p><span className="text-muted-foreground">Data / turno:</span> {format(parseISODate(sel.data), 'dd/MM/yyyy')} · {sel.turno ?? '—'}</p>
                <p><span className="text-muted-foreground">Registrado por:</span> {sel.registrado_por ?? '—'}</p>
                <p className="whitespace-pre-wrap"><span className="text-muted-foreground">Descrição:</span> {sel.descricao}</p>
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs gap-1"
                  onClick={() => setOrigem({ tabela: sel.source_tabela, id: sel.source_id })}
                >
                  <ExternalLink className="w-3 h-3" /> Consultar formulário original
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Responsável pela solução</Label>
                  <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prazo</Label>
                  <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} className="h-8 text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pendente', 'em_andamento', 'resolvido'].map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Solução registrada</Label>
                <Textarea
                  value={form.solucao}
                  onChange={(e) => setForm({ ...form, solucao: e.target.value })}
                  className="text-xs min-h-[70px] !normal-case"
                  preserveCase
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSel(null)}>Fechar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
