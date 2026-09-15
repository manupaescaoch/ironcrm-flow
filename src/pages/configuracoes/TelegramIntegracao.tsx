import { useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Send, RefreshCw, Users, CheckCircle2, AlertTriangle, Copy, Link2,
  Unlink, Users2, Clock, XCircle, Search, PlugZap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTelegramIntegracao, type TelegramUserRow } from '@/hooks/useTelegramIntegracao';

const STATUS_LABEL: Record<string, string> = {
  nao_configurado: 'Não configurado',
  conectado: 'Conectado',
  erro: 'Erro de conexão',
};

function StatusDot({ tone }: { tone: 'verde' | 'amarelo' | 'vermelho' | 'cinza' }) {
  const map = {
    verde: 'bg-emerald-500',
    amarelo: 'bg-amber-500',
    vermelho: 'bg-destructive',
    cinza: 'bg-muted-foreground/50',
  } as const;
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', map[tone])} />;
}

function UserStatusBadge({ status }: { status: TelegramUserRow['status'] }) {
  if (status === 'conectado') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <StatusDot tone="verde" /> Conectado
      </span>
    );
  }
  if (status === 'inativo') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <StatusDot tone="cinza" /> Inativo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
      <StatusDot tone="amarelo" /> Não conectado
    </span>
  );
}

function MetricCard({
  label, value, icon: Icon, tone,
}: { label: string; value: number | string; icon: typeof Users; tone: 'verde' | 'amarelo' | 'vermelho' | 'cinza' }) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg',
          tone === 'verde' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          tone === 'amarelo' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          tone === 'vermelho' && 'bg-destructive/10 text-destructive',
          tone === 'cinza' && 'bg-muted text-muted-foreground',
        )}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-semibold leading-none tracking-tight">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TelegramIntegracao() {
  const {
    health, connectedAt, users, groups, detected, falhas24h,
    loading, checking, loadHealth, loadData, callAdmin,
  } = useTelegramIntegracao();

  const [busca, setBusca] = useState('');
  const [acao, setAcao] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ nome: string; link: string } | null>(null);
  const [grupoDialog, setGrupoDialog] = useState<{ id: string; name: string; unidade: string } | null>(null);

  const status = health?.status ?? 'nao_configurado';
  const conectado = status === 'conectado';

  const conectados = users.filter((u) => u.status === 'conectado').length;
  const pendentes = users.filter((u) => u.status === 'nao_conectado').length;
  const gruposConectados = groups.filter((g) => g.status === 'conectado').length;

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.unidades.toLowerCase().includes(q));
  }, [users, busca]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setAcao(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível concluir a ação.');
    } finally {
      setAcao(null);
    }
  };

  const verificar = async () => {
    const h = await loadHealth();
    await loadData();
    if (h?.status === 'conectado') toast.success('Bot conectado com sucesso.');
    else toast.error('Não foi possível conectar ao bot. Verifique a configuração da integração.');
  };

  const testarIntegracao = () => run('teste', async () => {
    try {
      await callAdmin({ action: 'test_integration' });
      toast.success('Mensagem de teste enviada ao seu Telegram.');
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (msg.includes('admin_nao_conectado')) {
        toast.error('Conecte seu próprio Telegram na aba Usuários antes de testar.');
        return;
      }
      throw e;
    }
    await loadData();
  });

  const ativarWebhook = () => run('webhook', async () => {
    await callAdmin({ action: 'setup_webhook' });
    toast.success('Recebimento de mensagens do bot ativado.');
  });

  const gerarLink = (u: TelegramUserRow) => run(`link-${u.user_id}`, async () => {
    const data = await callAdmin({ action: 'generate_link', user_id: u.user_id });
    setLinkDialog({ nome: u.nome, link: data.link });
    await loadData();
  });

  const desconectarUsuario = (u: TelegramUserRow) => run(`off-${u.user_id}`, async () => {
    await callAdmin({ action: 'disconnect_user', user_id: u.user_id });
    toast.success(`Telegram de ${u.nome} desconectado.`);
    await loadData();
  });

  const gruposPorUnidade = useMemo(() => {
    const mapa = new Map<string, { nome: string; grupos: typeof groups }>();
    for (const g of groups) {
      const key = g.unidade_id ?? 'sem-unidade';
      const nome = g.unidade_nome ?? 'Geral';
      if (!mapa.has(key)) mapa.set(key, { nome, grupos: [] });
      mapa.get(key)!.grupos.push(g);
    }
    const ordem = ['coordenadores', 'comercial', 'gerencia'];
    for (const v of mapa.values()) {
      v.grupos.sort((a, b) => ordem.indexOf(a.group_type) - ordem.indexOf(b.group_type));
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [groups]);

  const vincularGrupo = (chatId: number) => run(`grupo-${chatId}`, async () => {
    if (!grupoDialog) return;
    await callAdmin({ action: 'assign_group', group_id: grupoDialog.id, telegram_chat_id: chatId });
    toast.success(`Grupo ${grupoDialog.name} (${grupoDialog.unidade}) conectado.`);
    setGrupoDialog(null);
    await loadData();
  });

  const desconectarGrupo = (id: string, name: string) => run(`grupo-off-${id}`, async () => {
    await callAdmin({ action: 'disconnect_group', group_id: id });
    toast.success(`Grupo ${name} desconectado.`);
    await loadData();
  });

  const testarGrupo = (id: string, name: string) => run(`grupo-teste-${id}`, async () => {
    await callAdmin({ action: 'test_integration', group_id: id });
    toast.success(`Mensagem de teste enviada ao grupo ${name}.`);
    await loadData();
  });

  const copiar = async (texto: string) => {
    await navigator.clipboard.writeText(texto);
    toast.success('Link copiado.');
  };

  const carregarConvites = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const { data: res } = await supabase.functions.invoke('telegram-convites-whatsapp', {
        body: { action: 'status' },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res) setConvites({ enviados: res.enviados ?? 0, pendentes: res.pendentes ?? 0, falhas: res.falhas ?? 0 });
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    carregarConvites();
  }, [carregarConvites]);

  useEffect(() => {
    if (!convites?.pendentes) return;
    const t = setInterval(carregarConvites, 20000);
    return () => clearInterval(t);
  }, [convites?.pendentes, carregarConvites]);

  const enviarLinksWhatsApp = () => run('convites', async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const { data: res, error } = await supabase.functions.invoke('telegram-convites-whatsapp', {
      body: { action: 'enfileirar' },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (error) throw error;
    toast.success(`${res?.enfileirados ?? 0} mensagens na fila. Envio a cada 45 segundos.`);
    await carregarConvites();
  });

  const cancelarConvites = () => run('convites-cancelar', async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    await supabase.functions.invoke('telegram-convites-whatsapp', {
      body: { action: 'cancelar' },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    toast.success('Fila cancelada.');
    await carregarConvites();
  });

  return (
    <Layout>
      <div className="mx-auto w-full max-w-5xl p-4 md:p-8 space-y-6">
        <header className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Configurações · Integrações
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Telegram</h1>
          <p className="text-sm text-muted-foreground">
            Conecte o bot oficial da EVO para enviar cobranças de formulários e respostas aos grupos.
          </p>
        </header>

        <Tabs defaultValue="visao" className="space-y-5">
          <TabsList>
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="grupos">Grupos</TabsTrigger>
          </TabsList>

          {/* ---------------- VISÃO GERAL ---------------- */}
          <TabsContent value="visao" className="space-y-5">
            <Card className="border-border/60 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Send className="h-4 w-4 text-primary" />
                  Telegram Bot
                </CardTitle>
                {checking && !health ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Badge
                    variant={conectado ? 'default' : status === 'erro' ? 'destructive' : 'secondary'}
                    className="gap-1.5 font-normal"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${conectado ? 'bg-current' : 'bg-current opacity-60'}`} />
                    {STATUS_LABEL[status]}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                {conectado ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-base font-medium">{health?.bot?.name ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">
                        {health?.bot?.username ? `@${health.bot.username}` : '—'}
                      </p>
                    </div>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">Status da integração</dt>
                        <dd className="flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Integração ativa
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Data da conexão</dt>
                        <dd className="font-medium">
                          {connectedAt ? new Date(connectedAt).toLocaleString('pt-BR') : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Última sincronização</dt>
                        <dd className="font-medium">
                          {health?.checkedAt ? new Date(health.checkedAt).toLocaleString('pt-BR') : '—'}
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    {status === 'erro' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                    Configure o token do bot nas variáveis seguras do projeto.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={verificar} disabled={checking}>
                    {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {conectado ? 'Verificar bot' : 'Verificar conexão'}
                  </Button>
                  <Button onClick={testarIntegracao} disabled={!conectado || acao === 'teste'}>
                    {acao === 'teste' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Testar integração
                  </Button>
                  <Button variant="ghost" onClick={ativarWebhook} disabled={!conectado || acao === 'webhook'}>
                    {acao === 'webhook' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                    Ativar recebimento
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Usuários conectados" value={conectados} icon={Users} tone="verde" />
              <MetricCard label="Usuários pendentes" value={pendentes} icon={Clock} tone="amarelo" />
              <MetricCard label="Grupos conectados" value={gruposConectados} icon={Users2} tone="verde" />
              <MetricCard label="Falhas de envio (24h)" value={falhas24h} icon={XCircle} tone={falhas24h > 0 ? 'vermelho' : 'cinza'} />
            </div>
          </TabsContent>

          {/* ---------------- USUÁRIOS ---------------- */}
          <TabsContent value="usuarios" className="space-y-4">
            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Envio dos links por WhatsApp</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Envia o link exclusivo de conexão para cada colaborador ainda não conectado que tenha
                  telefone cadastrado, pelo WhatsApp da Manu, com intervalo de 45 segundos entre as mensagens.
                </p>
                {convites && (
                  <p className="text-foreground">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{convites.enviados} enviadas</span>
                    {' · '}
                    <span className="font-medium text-amber-600 dark:text-amber-400">{convites.pendentes} na fila</span>
                    {convites.falhas > 0 && (
                      <>
                        {' · '}
                        <span className="font-medium text-destructive">{convites.falhas} falharam</span>
                      </>
                    )}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!conectado || acao === 'convites'}
                    onClick={enviarLinksWhatsApp}
                  >
                    {acao === 'convites'
                      ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      : <Send className="mr-1.5 h-3.5 w-3.5" />}
                    Enviar links por WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={carregarConvites}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
                  </Button>
                  {!!convites?.pendentes && (
                    <Button size="sm" variant="ghost" onClick={cancelarConvites}>
                      Cancelar fila
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou unidade"
                className="pl-9"
              />
            </div>

            <Card className="border-border/60 shadow-none">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center p-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead>Função</TableHead>
                          <TableHead>Turno</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Telegram</TableHead>
                          <TableHead>Conexão</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtrados.map((u) => (
                          <TableRow key={u.user_id}>
                            <TableCell className="font-medium">
                              {u.nome}
                              <span className="block text-xs font-normal text-muted-foreground">{u.email}</span>
                            </TableCell>
                            <TableCell className="text-sm">{u.unidades}</TableCell>
                            <TableCell className="text-sm">{u.funcao}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{u.turno}</TableCell>
                            <TableCell><UserStatusBadge status={u.status} /></TableCell>
                            <TableCell className="text-sm">
                              {u.telegram_username ? `@${u.telegram_username}` : '—'}
                              <span className="block text-xs text-muted-foreground">{u.telegram_user_id ?? ''}</span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {u.connected_at ? new Date(u.connected_at).toLocaleDateString('pt-BR') : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!conectado || acao === `link-${u.user_id}`}
                                  onClick={() => gerarLink(u)}
                                >
                                  {acao === `link-${u.user_id}`
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Link2 className="h-3.5 w-3.5" />}
                                  <span className="ml-1.5 hidden sm:inline">Gerar link</span>
                                </Button>
                                {u.status === 'conectado' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={acao === `off-${u.user_id}`}
                                    onClick={() => desconectarUsuario(u)}
                                  >
                                    {acao === `off-${u.user_id}`
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <Unlink className="h-3.5 w-3.5" />}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filtrados.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                              Nenhum colaborador encontrado.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- GRUPOS ---------------- */}
          <TabsContent value="grupos" className="space-y-4">
            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Como conectar um grupo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>1. Adicione <span className="font-medium text-foreground">{health?.bot?.username ? `@${health.bot.username}` : 'o bot da EVO'}</span> ao grupo do Telegram.</p>
                <p>2. Envie qualquer mensagem nesse grupo.</p>
                <p>3. Clique em <span className="font-medium text-foreground">Conectar grupo</span> abaixo e escolha o grupo detectado.</p>
              </CardContent>
            </Card>

            {gruposPorUnidade.map((secao) => (
              <section key={secao.nome} className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {secao.nome}
                </h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {secao.grupos.map((g) => {
                    const ativo = g.status === 'conectado';
                    return (
                      <Card key={g.id} className="border-border/60 shadow-none">
                        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                          <CardTitle className="text-base font-medium">{g.name}</CardTitle>
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <StatusDot tone={ativo ? 'verde' : 'amarelo'} />
                            {ativo ? 'Conectado' : 'Não conectado'}
                          </span>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="min-h-[38px] text-sm">
                            <p className="font-medium">{g.telegram_title ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">
                              {g.connected_at ? `Desde ${new Date(g.connected_at).toLocaleDateString('pt-BR')}` : 'Aguardando conexão'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant={ativo ? 'outline' : 'default'}
                              disabled={!conectado}
                              onClick={() => setGrupoDialog({ id: g.id, name: g.name, unidade: secao.nome })}
                            >
                              {ativo ? 'Trocar grupo' : 'Conectar grupo'}
                            </Button>
                            {ativo && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={acao === `grupo-teste-${g.id}`}
                                  onClick={() => testarGrupo(g.id, g.name)}
                                >
                                  {acao === `grupo-teste-${g.id}`
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Testar'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={acao === `grupo-off-${g.id}`}
                                  onClick={() => desconectarGrupo(g.id, g.name)}
                                >
                                  {acao === `grupo-off-${g.id}`
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Remover'}
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog do link de conexão */}
      <Dialog open={!!linkDialog} onOpenChange={(o) => !o && setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de conexão</DialogTitle>
            <DialogDescription>
              Envie este link para {linkDialog?.nome}. Ao abrir e iniciar o bot, o Telegram é conectado automaticamente.
              O link vale por 48 horas e só pode ser usado uma vez.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={linkDialog?.link ?? ''} className="font-mono text-xs" />
            <Button size="icon" variant="outline" onClick={() => linkDialog && copiar(linkDialog.link)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de seleção de grupo detectado */}
      <Dialog open={!!grupoDialog} onOpenChange={(o) => !o && setGrupoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar grupo · {grupoDialog?.name} ({grupoDialog?.unidade})</DialogTitle>
            <DialogDescription>
              Escolha abaixo o grupo do Telegram correspondente. Se ele não aparecer, adicione o bot ao grupo e envie uma mensagem lá.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {detected.length === 0 && (
              <p className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
                Nenhum grupo detectado ainda.
              </p>
            )}
            {detected.map((d) => (
              <button
                key={d.telegram_chat_id}
                onClick={() => vincularGrupo(d.telegram_chat_id)}
                disabled={acao === `grupo-${d.telegram_chat_id}`}
                className="flex w-full items-center justify-between rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
              >
                <div>
                  <p className="text-sm font-medium">{d.title ?? `Grupo ${d.telegram_chat_id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    Visto em {new Date(d.last_seen_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                {acao === `grupo-${d.telegram_chat_id}`
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Link2 className="h-4 w-4 text-muted-foreground" />}
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={loadData} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar lista
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
