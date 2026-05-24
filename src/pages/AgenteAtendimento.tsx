import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as React from 'react';

// Inputs locais SEM forçar caixa alta (página de configuração do agente)
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bot, Send, Save, Power, PowerOff, RotateCcw, Eye, ExternalLink, FileText, Loader2, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const REGRAS_LIST: { key: string; label: string }[] = [
  { key: 'agente_ativo', label: 'Agente ativo' },
  { key: 'nao_fora_escopo', label: 'Não responder fora do escopo' },
  { key: 'nunca_inventar', label: 'Nunca inventar informações' },
  { key: 'tom_consultivo', label: 'Usar tom consultivo' },
  { key: 'evitar_longas', label: 'Evitar mensagens longas' },
  { key: 'dividir_blocos', label: 'Dividir respostas grandes em blocos curtos' },
  { key: 'conduzir_experimental', label: 'Conduzir até solicitação da experimental' },
  { key: 'registrar_resumo', label: 'Registrar resumo da conversa' },
  { key: 'atualizar_status', label: 'Atualizar status do lead automaticamente' },
];

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  novo: { label: 'Novo', variant: 'secondary' },
  em_atendimento: { label: 'Em atendimento', variant: 'default' },
  qualificado: { label: 'Qualificado', variant: 'outline' },
  experimental_solicitada: { label: 'Experimental solicitada', variant: 'default' },
  sem_resposta: { label: 'Sem resposta', variant: 'destructive' },
  finalizado: { label: 'Finalizado', variant: 'outline' },
};

const EXPERIMENTAL_FIELDS = [
  { key: 'nome_lead', label: 'Nome do lead' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'objetivo', label: 'Objetivo' },
  { key: 'horario_preferido', label: 'Horário preferido de treino' },
  { key: 'unidade_interesse', label: 'Unidade de interesse' },
  { key: 'plano_indicado', label: 'Plano indicado' },
  { key: 'dia_desejado', label: 'Dia desejado' },
  { key: 'horario_desejado', label: 'Horário desejado' },
  { key: 'resumo_conversa', label: 'Resumo da conversa' },
];

interface AgenteRow {
  id: string;
  unidade_id: string;
  nome: string;
  descricao: string | null;
  prompt: string | null;
  mensagem_inicial: string | null;
  mensagem_pos_solicitacao: string | null;
  status: string;
  canal: string;
  regras: Record<string, boolean> | null;
  configuracao_experimental: Record<string, any> | null;
  atualizado_por: string | null;
  updated_at: string;
}

interface AtendimentoRow {
  id: string;
  nome: string | null;
  telefone: string | null;
  canal: string;
  status: string;
  objetivo: string | null;
  unidade_interesse: string | null;
  plano_indicado: string | null;
  ultima_interacao_at: string | null;
  lead_id: string | null;
  resumo_conversa: string | null;
}

interface VersaoRow {
  id: string;
  created_at: string;
  criado_por_nome: string | null;
  status: string | null;
  prompt: string | null;
  mensagem_inicial: string | null;
  regras: Record<string, boolean> | null;
  configuracao_experimental: Record<string, any> | null;
}

export default function AgenteAtendimento() {
  const { user, userRole } = useAuth();
  const { unidadeAtual } = useUnidade();
  const canEdit = userRole === 'admin' || userRole === 'comercial';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agente, setAgente] = useState<AgenteRow | null>(null);

  // Form fields
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [mensagemInicial, setMensagemInicial] = useState('');
  const [prompt, setPrompt] = useState('');
  const [mensagemPos, setMensagemPos] = useState('');
  const [regras, setRegras] = useState<Record<string, boolean>>({});
  const [camposExperimental, setCamposExperimental] = useState<Record<string, boolean>>(
    () => Object.fromEntries(EXPERIMENTAL_FIELDS.map((f) => [f.key, true]))
  );

  // Atendimentos
  const [atendimentos, setAtendimentos] = useState<AtendimentoRow[]>([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState('30d');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroCanal, setFiltroCanal] = useState('todos');
  const [resumoOpen, setResumoOpen] = useState<AtendimentoRow | null>(null);

  // Test agent - chat fluido
  const [testMsg, setTestMsg] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [testing, setTesting] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, testing]);

  // Versions
  const [versoes, setVersoes] = useState<VersaoRow[]>([]);

  // Load agent + atendimentos + versions
  const carregar = async () => {
    if (!unidadeAtual) return;
    setLoading(true);

    let { data: ag } = await supabase
      .from('agentes_atendimento')
      .select('*')
      .eq('unidade_id', unidadeAtual.id)
      .maybeSingle();

    if (!ag) {
      const { data: novo } = await supabase
        .from('agentes_atendimento')
        .insert({
          unidade_id: unidadeAtual.id,
          nome: 'SDR IRON CLUB',
          status: 'inativo',
          canal: 'whatsapp',
          criado_por: user?.id,
          atualizado_por: user?.id,
          regras: Object.fromEntries(REGRAS_LIST.map((r) => [r.key, true])),
          configuracao_experimental: { campos: Object.fromEntries(EXPERIMENTAL_FIELDS.map((f) => [f.key, true])) },
        })
        .select('*')
        .maybeSingle();
      ag = novo;
    }

    if (ag) {
      setAgente(ag as any);
      setNome(ag.nome || '');
      setDescricao(ag.descricao || '');
      setMensagemInicial(ag.mensagem_inicial || '');
      setPrompt(ag.prompt || '');
      setMensagemPos(ag.mensagem_pos_solicitacao || '');
      setRegras((ag.regras as any) || {});
      const exp = (ag.configuracao_experimental as any)?.campos;
      if (exp) setCamposExperimental(exp);

      const [atRes, verRes] = await Promise.all([
        supabase
          .from('agente_atendimentos')
          .select('id,nome,telefone,canal,status,objetivo,unidade_interesse,plano_indicado,ultima_interacao_at,lead_id,resumo_conversa')
          .eq('unidade_id', unidadeAtual.id)
          .order('ultima_interacao_at', { ascending: false, nullsFirst: false })
          .limit(200),
        supabase
          .from('agentes_atendimento_versoes')
          .select('*')
          .eq('agente_id', ag.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      setAtendimentos((atRes.data as any) || []);
      setVersoes((verRes.data as any) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtual?.id]);

  // KPIs
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let hoje = 0, semana = 0, mes = 0, qualificados = 0, experimentais = 0;
    for (const a of atendimentos) {
      const d = a.ultima_interacao_at ? new Date(a.ultima_interacao_at) : null;
      if (d) {
        if (d >= today) hoje++;
        if (d >= weekStart) semana++;
        if (d >= monthStart) mes++;
      }
      if (['qualificado', 'experimental_solicitada'].includes(a.status)) qualificados++;
      if (a.status === 'experimental_solicitada') experimentais++;
    }
    const taxa = atendimentos.length ? (experimentais / atendimentos.length) * 100 : 0;
    return { hoje, semana, mes, qualificados, experimentais, taxa };
  }, [atendimentos]);

  const atendimentosFiltrados = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let cutoff: Date | null = null;
    if (filtroPeriodo === 'hoje') cutoff = today;
    else if (filtroPeriodo === '7d') { cutoff = new Date(today); cutoff.setDate(today.getDate() - 7); }
    else if (filtroPeriodo === '30d') { cutoff = new Date(today); cutoff.setDate(today.getDate() - 30); }

    return atendimentos.filter((a) => {
      if (cutoff && (!a.ultima_interacao_at || new Date(a.ultima_interacao_at) < cutoff)) return false;
      if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false;
      if (filtroCanal !== 'todos' && a.canal !== filtroCanal) return false;
      return true;
    });
  }, [atendimentos, filtroPeriodo, filtroStatus, filtroCanal]);

  const validate = (forActivate = false): string | null => {
    if (!nome.trim()) return 'Preencha o nome do agente.';
    if (forActivate) {
      if (!mensagemInicial.trim()) return 'Adicione uma mensagem inicial antes de ativar o agente.';
      if (!prompt.trim()) return 'Adicione um prompt antes de ativar o agente.';
    }
    return null;
  };

  const salvar = async (novoStatus?: string) => {
    if (!agente) return;
    const err = validate(novoStatus === 'ativo');
    if (err) {
      toast({ title: 'Atenção', description: err, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: any = {
      nome,
      descricao,
      prompt,
      mensagem_inicial: mensagemInicial,
      mensagem_pos_solicitacao: mensagemPos,
      regras,
      configuracao_experimental: { campos: camposExperimental },
      atualizado_por: user?.id,
    };
    if (novoStatus) payload.status = novoStatus;

    const { error } = await supabase
      .from('agentes_atendimento')
      .update(payload)
      .eq('id', agente.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      // save version snapshot
      await supabase.from('agentes_atendimento_versoes').insert({
        agente_id: agente.id,
        unidade_id: agente.unidade_id,
        nome,
        descricao,
        prompt,
        mensagem_inicial: mensagemInicial,
        mensagem_pos_solicitacao: mensagemPos,
        regras,
        configuracao_experimental: { campos: camposExperimental },
        status: novoStatus ?? agente.status,
        criado_por: user?.id,
        criado_por_nome: user?.email ?? null,
      });
      toast({ title: 'Salvo', description: 'Configurações atualizadas com sucesso.' });
      carregar();
    }
    setSaving(false);
  };

  const enviarMensagemTeste = async () => {
    const texto = testMsg.trim();
    if (!texto) return;
    if (!prompt.trim()) {
      toast({ title: 'Atenção', description: 'Preencha o prompt antes de testar.', variant: 'destructive' });
      return;
    }
    const novoHistorico = [...chat, { role: 'user' as const, content: texto }];
    setChat(novoHistorico);
    setTestMsg('');
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('agente-atendimento-test', {
        body: { prompt, mensagem_inicial: mensagemInicial, historico: novoHistorico },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const resposta = (data as any)?.resposta || '';
      setChat([...novoHistorico, { role: 'assistant', content: resposta }]);
    } catch (e: any) {
      toast({ title: 'Erro no teste', description: e.message || String(e), variant: 'destructive' });
      setChat(novoHistorico); // mantém a mensagem do usuário
    } finally {
      setTesting(false);
    }
  };

  const limparChat = () => setChat([]);

  const restaurarVersao = (v: VersaoRow) => {
    setPrompt(v.prompt || '');
    setMensagemInicial(v.mensagem_inicial || '');
    if (v.regras) setRegras(v.regras);
    if (v.configuracao_experimental?.campos) setCamposExperimental(v.configuracao_experimental.campos);
    toast({ title: 'Versão carregada', description: 'Revise e clique em Salvar para aplicar.' });
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Agente de Atendimento</h1>
              <p className="text-sm text-muted-foreground">
                Configure e acompanhe o agente SDR responsável pelo primeiro atendimento dos leads.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={agente?.status === 'ativo' ? 'default' : 'secondary'}>
              {agente?.status === 'ativo' ? 'Ativo' : 'Inativo'}
            </Badge>
            {agente?.status === 'ativo' ? (
              <Button variant="outline" size="sm" onClick={() => salvar('inativo')} disabled={saving || !canEdit}>
                <PowerOff className="w-4 h-4 mr-1" /> Desativar
              </Button>
            ) : (
              <Button size="sm" onClick={() => salvar('ativo')} disabled={saving || !canEdit}>
                <Power className="w-4 h-4 mr-1" /> Ativar agente
              </Button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { l: 'Atendidos hoje', v: stats.hoje },
            { l: 'Atendidos na semana', v: stats.semana },
            { l: 'Atendidos no mês', v: stats.mes },
            { l: 'Leads qualificados', v: stats.qualificados },
            { l: 'Experimentais solicitadas', v: stats.experimentais },
            { l: 'Conversão p/ experimental', v: `${stats.taxa.toFixed(1)}%` },
          ].map((k) => (
            <Card key={k.l}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{k.l}</p>
                <p className="text-2xl font-bold mt-1">{k.v}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros + Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atendimentos recentes</CardTitle>
            <CardDescription>Histórico de leads atendidos pelo agente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroCanal} onValueChange={setFiltroCanal}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Canal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os canais</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Objetivo</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Última interação</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atendimentosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhum atendimento ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {atendimentosFiltrados.map((a) => {
                    const st = STATUS_LABELS[a.status] || { label: a.status, variant: 'outline' as const };
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.nome || '—'}</TableCell>
                        <TableCell>{a.telefone || '—'}</TableCell>
                        <TableCell className="capitalize">{a.canal}</TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell className="max-w-[160px] truncate">{a.objetivo || '—'}</TableCell>
                        <TableCell>{a.unidade_interesse || '—'}</TableCell>
                        <TableCell>{a.plano_indicado || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {a.ultima_interacao_at ? new Date(a.ultima_interacao_at).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" title="Ver resumo" onClick={() => setResumoOpen(a)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {a.lead_id && (
                              <Button size="icon" variant="ghost" title="Abrir lead" asChild>
                                <Link to={`/lead/${a.lead_id}`}><ExternalLink className="w-4 h-4" /></Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurações do agente</CardTitle>
            <CardDescription>
              Última atualização: {agente?.updated_at ? new Date(agente.updated_at).toLocaleString('pt-BR') : '—'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do agente</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: SDR IRON CLUB" disabled={!canEdit} />
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Input value={agente?.canal || 'whatsapp'} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Função do agente</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Agente responsável por atender leads, qualificar interesse e conduzir até a solicitação da experimental."
                rows={2}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem inicial</Label>
              <Textarea
                value={mensagemInicial}
                onChange={(e) => setMensagemInicial(e.target.value)}
                placeholder="Olá! Tudo bem? Antes de te passar os detalhes, me conta uma coisa: qual é o seu principal objetivo hoje?"
                rows={3}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Prompt do agente</Label>
                <span className="text-xs text-muted-foreground">
                  Caracteres: {prompt.length} / 8000
                </span>
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 8000))}
                rows={12}
                className="font-mono text-xs"
                placeholder="Instruções completas para o agente SDR..."
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>

        {/* Regras rápidas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Regras rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {REGRAS_LIST.map((r) => (
                <label key={r.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!regras[r.key]}
                    onCheckedChange={(v) => setRegras((prev) => ({ ...prev, [r.key]: !!v }))}
                    disabled={!canEdit}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Agendamento da experimental */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agendamento da experimental</CardTitle>
            <CardDescription>Campos obrigatórios e mensagem padrão após solicitação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {EXPERIMENTAL_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={!!camposExperimental[f.key]}
                    onCheckedChange={(v) => setCamposExperimental((p) => ({ ...p, [f.key]: v }))}
                    disabled={!canEdit}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Mensagem padrão após solicitação</Label>
              <Textarea
                value={mensagemPos}
                onChange={(e) => setMensagemPos(e.target.value)}
                rows={4}
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>

        {/* Testar agente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Testar agente</CardTitle>
            <CardDescription>Simule uma mensagem usando o prompt acima</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              placeholder="Digite uma mensagem como se fosse um lead..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button onClick={testar} disabled={testing}>
                {testing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                Enviar teste
              </Button>
              <Button variant="outline" onClick={() => { setTestMsg(''); setTestResp(''); }}>
                Limpar teste
              </Button>
            </div>
            {testResp && (
              <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Resposta do agente</p>
                {testResp}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botões principais */}
        <div className="flex flex-wrap gap-2 sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-lg border">
          <Button onClick={() => salvar()} disabled={saving || !canEdit}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar configurações
          </Button>
          <Button variant="outline" onClick={testar} disabled={testing}>
            <Send className="w-4 h-4 mr-1" /> Testar agente
          </Button>
          {agente?.status !== 'ativo' ? (
            <Button variant="default" onClick={() => salvar('ativo')} disabled={saving || !canEdit}>
              <Power className="w-4 h-4 mr-1" /> Ativar agente
            </Button>
          ) : (
            <Button variant="outline" onClick={() => salvar('inativo')} disabled={saving || !canEdit}>
              <PowerOff className="w-4 h-4 mr-1" /> Desativar agente
            </Button>
          )}
        </div>

        {/* Histórico de versões */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><History className="w-4 h-4" /> Histórico de versões</CardTitle>
          </CardHeader>
          <CardContent>
            {versoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma versão salva ainda.</p>
            ) : (
              <div className="space-y-2">
                {versoes.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 p-3 rounded-md border">
                    <div className="text-sm">
                      <p className="font-medium">{new Date(v.created_at).toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.criado_por_nome || '—'} · status: {v.status || '—'}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => restaurarVersao(v)} disabled={!canEdit}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Carregar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!resumoOpen} onOpenChange={(o) => !o && setResumoOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> Resumo da conversa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Lead:</span> {resumoOpen?.nome || '—'}</p>
            <p><span className="text-muted-foreground">Telefone:</span> {resumoOpen?.telefone || '—'}</p>
            <p><span className="text-muted-foreground">Objetivo:</span> {resumoOpen?.objetivo || '—'}</p>
            <p><span className="text-muted-foreground">Plano indicado:</span> {resumoOpen?.plano_indicado || '—'}</p>
            <div className="pt-2 border-t">
              <p className="text-muted-foreground mb-1">Resumo:</p>
              <p className="whitespace-pre-wrap">{resumoOpen?.resumo_conversa || 'Sem resumo registrado.'}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
