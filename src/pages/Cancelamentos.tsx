import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserX, ExternalLink, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CancelamentosDashboard } from '@/components/cancelamentos/CancelamentosDashboard';

const STATUS = ['Nova solicitação', 'Em contato', 'Retenção em andamento', 'Retido', 'Cancelamento concluído', 'Sem retorno'];

function notaClass(n: number | null) {
  if (n == null) return 'bg-muted text-muted-foreground';
  if (n <= 6) return 'bg-destructive text-destructive-foreground';
  if (n <= 8) return 'bg-warning text-warning-foreground';
  return 'bg-success text-success-foreground';
}

const simNao = (v: boolean | null) => (v == null ? null : v ? 'Sim' : 'Não');

function Bloco({ titulo, itens }: { titulo: string; itens: [string, any][] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{titulo}</p>
      <dl className="divide-y rounded-lg border text-sm">
        {itens.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-3 py-2 sm:grid-cols-[170px_1fr]">
            <dt className="text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap font-medium">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Observacoes({ id }: { id: string }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ['cancelamento-obs', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('cancelamento_observacoes' as any).select('*').eq('solicitacao_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const salvar = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    const { data: u } = await supabase.auth.getUser();
    const nome = (u.user?.user_metadata as any)?.nome || (u.user?.user_metadata as any)?.full_name || u.user?.email;
    const { error } = await supabase.from('cancelamento_observacoes' as any).insert({ solicitacao_id: id, user_id: u.user?.id, usuario_nome: nome, texto: texto.trim() });
    setSalvando(false);
    if (error) return toast.error('Não foi possível salvar a observação');
    setTexto('');
    qc.invalidateQueries({ queryKey: ['cancelamento-obs', id] });
  };
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Observação interna</p>
      <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Contato realizado. Aluno relatou dificuldade de horário." rows={3} />
      <Button size="sm" className="mt-2" onClick={salvar} disabled={salvando || !texto.trim()}>{salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Registrar observação</Button>
      <div className="mt-3 space-y-2">
        {data.map((o) => (
          <div key={o.id} className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="whitespace-pre-wrap">{o.texto}</p>
            <p className="mt-1 text-xs text-muted-foreground">{o.usuario_nome ?? 'Usuário'} · {new Date(o.created_at).toLocaleDateString('pt-BR')} às {new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Cancelamentos() {
  const { unidadeAtual, unidadesPermitidas } = useUnidade();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [fUnid, setFUnid] = useState(unidadeAtual?.id ?? 'all');
  const [fNota, setFNota] = useState('all');
  const [fRet, setFRet] = useState('all');
  const [fMotivo, setFMotivo] = useState('all');
  const [sel, setSel] = useState<any | null>(null);

  useEffect(() => { setFUnid(unidadeAtual?.id ?? 'all'); }, [unidadeAtual?.id]);

  const { data = [], isLoading } = useQuery({
    queryKey: ['cancelamentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cancelamento_solicitacoes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: ativosPorUnidade = {} } = useQuery({
    queryKey: ['cancelamentos-ativos'],
    queryFn: async () => {
      const { data } = await supabase.from('gestao_metas').select('unidade_id, alunos_ativos_manual');
      const m: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { if (r.unidade_id) m[r.unidade_id] = r.alunos_ativos_manual ?? 0; });
      return m;
    },
  });

  useEffect(() => {
    const ch = supabase.channel('cancelamentos-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cancelamento_solicitacoes' }, () => qc.invalidateQueries({ queryKey: ['cancelamentos'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const unidades = unidadesPermitidas.map((u: any) => ({ id: u.id, nome: u.nome }));
  const todosMotivos = useMemo(() => [...new Set(data.flatMap((r) => r.motivos ?? []))].sort(), [data]);

  const lista = useMemo(() => {
    const t = busca.trim().toUpperCase();
    const dig = t.replace(/\D/g, '');
    return data.filter((r) => {
      if (t && !(r.nome?.toUpperCase().includes(t) || (dig && r.telefone?.includes(dig)))) return false;
      if (fStatus !== 'all' && r.status !== fStatus) return false;
      if (fUnid !== 'all' && r.unidade_id !== fUnid) return false;
      if (fNota === 'baixa' && !(r.nota != null && r.nota <= 6)) return false;
      if (fNota === 'media' && !(r.nota >= 7 && r.nota <= 8)) return false;
      if (fNota === 'alta' && !(r.nota >= 9)) return false;
      if (fRet === 'sim' && r.aceita_contato_antes !== true) return false;
      if (fRet === 'nao' && r.aceita_contato_antes === true) return false;
      if (fMotivo !== 'all' && !(r.motivos ?? []).includes(fMotivo)) return false;
      return true;
    });
  }, [data, busca, fStatus, fUnid, fNota, fRet, fMotivo]);

  const mudarStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('cancelamento_solicitacoes').update({ status }).eq('id', id);
    if (error) return toast.error('Não foi possível atualizar');
    toast.success('Status atualizado');
    setSel((s: any) => (s ? { ...s, status } : s));
    qc.invalidateQueries({ queryKey: ['cancelamentos'] });
  };

  const linkForm = `${window.location.origin}/cancelamento`;
  const waLink = (r: any) => `https://wa.me/${String(r.ddi ?? '+55').replace(/\D/g, '')}${String(r.telefone ?? '').replace(/\D/g, '')}`;

  const filtro = (valor: string, set: (v: string) => void, label: string, opts: [string, string][], w = 'w-44') => (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <Select value={valor} onValueChange={set}>
        <SelectTrigger className={w}><SelectValue /></SelectTrigger>
        <SelectContent>{opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

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

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard" className="px-6">Dashboard</TabsTrigger>
            <TabsTrigger value="respostas" className="px-6">Respostas</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            {isLoading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <CancelamentosDashboard key={unidadeAtual?.id ?? 'all'} data={data} unidades={unidades} ativosPorUnidade={ativosPorUnidade} unidadeInicial={unidadeAtual?.id ?? 'all'} />
            )}
          </TabsContent>

          <TabsContent value="respostas" className="mt-4 space-y-4">
            <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Busca</p>
                <Input placeholder="Nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-56" />
              </div>
              {filtro(fStatus, setFStatus, 'Status', [['all', 'Todos'], ...STATUS.map((s) => [s, s] as [string, string])], 'w-52')}
              {filtro(fUnid, setFUnid, 'Unidade', [['all', 'Todas'], ...unidades.map((u) => [u.id, u.nome] as [string, string])], 'w-52')}
              {filtro(fNota, setFNota, 'Nota', [['all', 'Todas'], ['baixa', '0–6'], ['media', '7–8'], ['alta', '9–10']], 'w-32')}
              {filtro(fRet, setFRet, 'Retenção', [['all', 'Todos'], ['sim', 'Aceitou contato'], ['nao', 'Não aceitou contato']])}
              {filtro(fMotivo, setFMotivo, 'Motivo', [['all', 'Todos'], ...todosMotivos.map((m) => [m, m] as [string, string])], 'w-56')}
            </CardContent></Card>

            <p className="text-sm text-muted-foreground">{lista.length} {lista.length === 1 ? 'resposta' : 'respostas'}</p>

            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : lista.length === 0 ? (
                  <p className="p-10 text-center text-muted-foreground">Nenhuma solicitação encontrada.</p>
                ) : (
                  <div className="divide-y">
                    {lista.map((r) => (
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
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {sel && (
            <div className="space-y-5">
              <SheetHeader><SheetTitle>{sel.nome}</SheetTitle></SheetHeader>

              <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Gestão do cancelamento</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={sel.status} onValueChange={(v) => mudarStatus(sel.id, v)}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{[...new Set([...STATUS, sel.status])].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" asChild>
                    <a href={waLink(sel)} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" /> Falar no WhatsApp</a>
                  </Button>
                </div>
              </div>

              <Bloco titulo="Identificação" itens={[['Nome', sel.nome], ['WhatsApp', `${sel.ddi ?? ''} ${sel.telefone ?? ''}`], ['Unidade', sel.unidade], ['Plano', sel.plano], ['Data da solicitação', new Date(sel.created_at).toLocaleString('pt-BR')]]} />
              <Bloco titulo="Motivo do cancelamento" itens={[['Motivos', (sel.motivos ?? []).join(', ')], ['Detalhamento', sel.detalhamento]]} />
              <Bloco titulo="Problemas relatados" itens={[['Problemas', (sel.problemas ?? []).join(', ')]]} />
              <Bloco titulo="Experiência" itens={[['Acompanhamento', sel.acompanhamento], ['Evolução', sel.evolucao], ['Nota geral', sel.nota != null ? `${sel.nota}/10` : null], ['O que mais gostou', sel.pontos_positivos], ['O que poderia ter evitado a saída', sel.evitaria_saida]]} />
              <Bloco titulo="Retenção" itens={[['Soluções que fariam reconsiderar', (sel.solucoes_retencao ?? []).join(', ')], ['Contato antes do cancelamento', simNao(sel.aceita_contato_antes)], ['Contato futuro', simNao(sel.aceita_contato_futuro)]]} />
              <Bloco titulo="Destino" itens={[['Pretende continuar treinando', sel.vai_treinar_outro_local], ['Academia / modalidade / solução', sel.proxima_escolha], ['Principal fator da escolha', sel.fator_escolha]]} />

              <Observacoes id={sel.id} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
