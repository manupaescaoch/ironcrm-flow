import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserX, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS = ['Nova solicitação', 'Em contato', 'Retido', 'Cancelado'];

function notaClass(n: number | null) {
  if (n == null) return 'bg-muted text-muted-foreground';
  if (n <= 6) return 'bg-destructive text-destructive-foreground';
  if (n <= 8) return 'bg-warning text-warning-foreground';
  return 'bg-success text-success-foreground';
}

export default function Cancelamentos() {
  const { unidadeAtual } = useUnidade();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<any | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['cancelamentos', unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from('cancelamento_solicitacoes').select('*').order('created_at', { ascending: false });
      if (unidadeAtual?.id) q = q.eq('unidade_id', unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const lista = useMemo(() => {
    const t = busca.trim().toUpperCase();
    return t ? data.filter((r: any) => r.nome.includes(t) || r.telefone.includes(t.replace(/\D/g, '') || '§')) : data;
  }, [data, busca]);

  const media = data.length ? (data.reduce((s: number, r: any) => s + (r.nota ?? 0), 0) / data.filter((r: any) => r.nota != null).length || 0).toFixed(1) : '—';
  const novas = data.filter((r: any) => r.status === 'Nova solicitação').length;
  const retencao = data.filter((r: any) => r.aceita_contato_antes).length;

  const mudarStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('cancelamento_solicitacoes').update({ status }).eq('id', id);
    if (error) return toast.error('Não foi possível atualizar');
    toast.success('Status atualizado');
    setSel((s: any) => (s ? { ...s, status } : s));
    qc.invalidateQueries({ queryKey: ['cancelamentos'] });
  };

  const linkForm = `${window.location.origin}/cancelamento`;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserX className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Cancelamentos</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(linkForm); toast.success('Link copiado'); }}>
              <Copy className="mr-1 h-4 w-4" /> Copiar link
            </Button>
            <Button size="sm" asChild>
              <a href="/cancelamento" target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" /> Abrir formulário</a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[['Solicitações', data.length], ['Novas', novas], ['Nota média', media], ['Aceitam contato', retencao]].map(([k, v]) => (
            <Card key={k as string}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
          ))}
        </div>

        <Input placeholder="Buscar por nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : lista.length === 0 ? (
              <p className="p-10 text-center text-muted-foreground">Nenhuma solicitação encontrada.</p>
            ) : (
              <div className="divide-y">
                {lista.map((r: any) => (
                  <button key={r.id} onClick={() => setSel(r)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold', notaClass(r.nota))}>{r.nota ?? '—'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.unidade} · {r.plano ?? '—'} · {(r.motivos ?? []).join(', ')}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <Badge variant={r.status === 'Nova solicitação' ? 'default' : 'secondary'}>{r.status}</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {sel && (
            <>
              <DialogHeader><DialogTitle>{sel.nome}</DialogTitle></DialogHeader>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Select value={sel.status} onValueChange={(v) => mudarStatus(sel.id, v)}>
                  <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <dl className="divide-y text-sm">
                {[
                  ['Data', new Date(sel.created_at).toLocaleString('pt-BR')],
                  ['WhatsApp', `${sel.ddi} ${sel.telefone}`],
                  ['Unidade', sel.unidade], ['Plano', sel.plano],
                  ['Motivos', (sel.motivos ?? []).join(', ')], ['Detalhamento', sel.detalhamento],
                  ['Problemas', (sel.problemas ?? []).join(', ')], ['Acompanhamento', sel.acompanhamento],
                  ['Evolução', sel.evolucao], ['Nota', sel.nota != null ? `${sel.nota}/10` : null],
                  ['O que mais gostou', sel.pontos_positivos], ['O que evitaria a saída', sel.evitaria_saida],
                  ['Soluções de retenção', (sel.solucoes_retencao ?? []).join(', ')],
                  ['Vai treinar em outro local', sel.vai_treinar_outro_local], ['Próxima escolha', sel.proxima_escolha],
                  ['Fator da escolha', sel.fator_escolha],
                  ['Contato antes do cancelamento', sel.aceita_contato_antes == null ? null : sel.aceita_contato_antes ? 'Sim' : 'Não'],
                  ['Contato futuro', sel.aceita_contato_futuro == null ? null : sel.aceita_contato_futuro ? 'Sim' : 'Não'],
                ].map(([k, v]) => (
                  <div key={k as string} className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]">
                    <dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v || '—'}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
