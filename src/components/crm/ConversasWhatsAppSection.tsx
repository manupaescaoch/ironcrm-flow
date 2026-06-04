import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidadeUsers } from '@/hooks/useUnidadeUsers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, MessageCircle, UserPlus, Archive, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Atendimento {
  id: string;
  nome: string | null;
  telefone: string | null;
  unidade_id: string;
  ultima_interacao_at: string | null;
  status: string;
  lead_id: string | null;
  ultima_mensagem?: string | null;
  ultima_role?: string | null;
  lead?: {
    id: string;
    nome: string;
    is_matriculado: boolean;
    status_funil: string;
  } | null;
}

interface Mensagem {
  id: string;
  role: string;
  conteudo: string;
  created_at: string;
}

const ORIGENS = [
  'WHATSAPP',
  'INSTAGRAM',
  'TRÁFEGO PAGO',
  'INDICAÇÃO',
  'VISITA PRESENCIAL',
  'TERCEIROS',
  'NÃO INFORMADO',
];

type TabKey = 'nao_vinculadas' | 'vinculadas' | 'todas';

interface Props {
  onCountsChange?: (counts: { total: number; naoVinculadas: number; semResposta: number; ativas: number; totalMensagens?: number }) => void;
  onLeadCreated?: () => void;
}

export function ConversasWhatsAppSection({ onCountsChange, onLeadCreated }: Props) {
  const { user, isAdmin } = useAuth();
  const { unidadeAtual, unidadesPermitidas } = useUnidade();
  const { users: unidadeUsers } = useUnidadeUsers();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('nao_vinculadas');

  const [drawerAtend, setDrawerAtend] = useState<Atendimento | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [modalAtend, setModalAtend] = useState<Atendimento | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formUnidade, setFormUnidade] = useState<string>('');
  const [formOrigem, setFormOrigem] = useState('WHATSAPP');
  const [formResponsavel, setFormResponsavel] = useState<string>('');
  const [formObservacao, setFormObservacao] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const fetchInbox = useCallback(async () => {
    if (!unidadeAtual) return;
    setLoading(true);

    let query = supabase
      .from('agente_atendimentos')
      .select('id, nome, telefone, unidade_id, ultima_interacao_at, status, lead_id, lead:leads(id, nome, is_matriculado, status_funil)')
      .neq('status', 'arquivado')
      .eq('unidade_id', unidadeAtual.id)
      .order('ultima_interacao_at', { ascending: false })
      .limit(200);

    const { data: atends, error } = await query;
    if (error) {
      toast({ title: 'Erro ao carregar conversas', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const ids = (atends || []).map((a) => a.id);
    const preview: Record<string, { conteudo: string; role: string }> = {};
    if (ids.length) {
      const { data: msgs } = await supabase
        .from('agente_mensagens')
        .select('atendimento_id, conteudo, role, created_at')
        .in('atendimento_id', ids)
        .order('created_at', { ascending: false });
      for (const m of msgs || []) {
        if (!preview[m.atendimento_id]) preview[m.atendimento_id] = { conteudo: m.conteudo, role: m.role };
      }
    }

    const mapped: Atendimento[] = (atends || []).map((a: any) => ({
      ...a,
      ultima_mensagem: preview[a.id]?.conteudo ?? null,
      ultima_role: preview[a.id]?.role ?? null,
    }));
    setAtendimentos(mapped);
    setLoading(false);

    // counts
    if (onCountsChange) {
      const total = mapped.length;
      const naoVinculadas = mapped.filter((a) => !a.lead_id).length;
      const semResposta = mapped.filter((a) => a.ultima_role === 'user').length;
      const ativas = mapped.filter((a) => a.status !== 'arquivado').length;
      onCountsChange({ total, naoVinculadas, semResposta, ativas });
    }
  }, [unidadeAtual, onCountsChange]);

  useEffect(() => {
    fetchInbox();
    const channel = supabase
      .channel('crm-conversas-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agente_atendimentos' }, () => fetchInbox())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agente_mensagens' }, () => fetchInbox())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInbox]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = atendimentos;
    if (tab === 'nao_vinculadas') base = base.filter((a) => !a.lead_id);
    else if (tab === 'vinculadas') base = base.filter((a) => !!a.lead_id);
    if (!q) return base;
    return base.filter(
      (a) =>
        (a.nome || '').toLowerCase().includes(q) ||
        (a.telefone || '').includes(q) ||
        (a.ultima_mensagem || '').toLowerCase().includes(q),
    );
  }, [atendimentos, search, tab]);

  const openDrawer = async (atend: Atendimento) => {
    setDrawerAtend(atend);
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('agente_mensagens')
      .select('id, role, conteudo, created_at')
      .eq('atendimento_id', atend.id)
      .order('created_at', { ascending: true })
      .limit(500);
    setMensagens((data || []) as Mensagem[]);
    setLoadingMsgs(false);
  };

  const openModal = (atend: Atendimento) => {
    setModalAtend(atend);
    setFormNome((atend.nome || `WHATSAPP ${(atend.telefone || '').slice(-4)}`).toUpperCase());
    setFormUnidade(unidadeAtual?.id || atend.unidade_id);
    setFormOrigem('WHATSAPP');
    const meName =
      (user?.user_metadata as any)?.full_name ||
      (user?.user_metadata as any)?.name ||
      user?.email ||
      '';
    setFormResponsavel(String(meName).toUpperCase());
    setFormObservacao('');
  };

  const transformarEmLead = async () => {
    if (!modalAtend || !formNome.trim() || !formUnidade) return;
    setSaving(true);

    const telDigits = (modalAtend.telefone || '').replace(/\D/g, '');
    const { data: dup } = await supabase
      .from('leads')
      .select('id')
      .eq('telefone_normalizado', telDigits)
      .eq('ativo', true)
      .maybeSingle();

    if (dup) {
      toast({
        title: 'Lead já existe',
        description: 'Já existe um lead ativo com este telefone. Vinculando a conversa…',
      });
      await supabase
        .from('agente_atendimentos')
        .update({ lead_id: dup.id, unidade_id: formUnidade })
        .eq('id', modalAtend.id);
      await supabase.from('leads').update({ atendimento_id: modalAtend.id }).eq('id', dup.id);
      setSaving(false);
      setModalAtend(null);
      fetchInbox();
      onLeadCreated?.();
      return;
    }

    const { data: novoLead, error: insertErr } = await supabase
      .from('leads')
      .insert({
        nome: formNome.trim().toUpperCase(),
        telefone: telDigits,
        origem: formOrigem,
        fonte: 'WHATSAPP',
        status_funil: 'novo',
        status_conversa: 'aguardando_resposta',
        ultima_interacao_at: new Date().toISOString(),
        unidade_id: formUnidade,
        atendimento_id: modalAtend.id,
        ativo: true,
        is_matriculado: false,
        cadastrado_por: formResponsavel.trim().toUpperCase() || null,
        created_by: user?.id,
      })
      .select('id')
      .single();

    if (insertErr || !novoLead) {
      toast({
        title: 'Erro ao criar lead',
        description: insertErr?.message || 'Erro desconhecido',
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    await supabase
      .from('agente_atendimentos')
      .update({ lead_id: novoLead.id, unidade_id: formUnidade })
      .eq('id', modalAtend.id);

    if (formObservacao.trim()) {
      await supabase.from('interacoes').insert({
        lead_id: novoLead.id,
        tipo: 'Observação',
        descricao: formObservacao.trim(),
        atendido_por: formResponsavel.trim().toUpperCase() || null,
      } as any);
    }

    toast({ title: 'Lead criado', description: `${formNome} foi adicionado ao funil.` });
    setSaving(false);
    setModalAtend(null);
    fetchInbox();
    onLeadCreated?.();
  };

  const arquivar = async (atend: Atendimento) => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from('agente_atendimentos')
      .update({ status: 'arquivado' })
      .eq('id', atend.id);
    if (error) {
      toast({ title: 'Erro ao arquivar', description: error.message, variant: 'destructive' });
      return;
    }
    fetchInbox();
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="w-5 h-5" />
              Conversas do WhatsApp
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Números recebidos pelo WhatsApp ainda não vinculados ou em processo de qualificação
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar nome, telefone ou mensagem…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button variant="outline" size="icon" onClick={fetchInbox} title="Atualizar">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mt-3">
          <TabsList>
            <TabsTrigger value="nao_vinculadas">
              Não vinculadas
              <Badge variant="secondary" className="ml-2">
                {atendimentos.filter((a) => !a.lead_id).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="vinculadas">
              Vinculadas
              <Badge variant="secondary" className="ml-2">
                {atendimentos.filter((a) => !!a.lead_id).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma conversa nesta visualização.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-y">
                <tr>
                  <th className="px-4 py-3 text-left">Nome / Telefone</th>
                  <th className="px-4 py-3 text-left">Última mensagem</th>
                  <th className="px-4 py-3 text-left">Última interação</th>
                  <th className="px-4 py-3 text-left">Unidade</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Vínculo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((a) => {
                  const vinculado = !!a.lead_id;
                  const matriculado = a.lead?.is_matriculado;
                  const unidadeNome = unidadesPermitidas.find(u => u.id === a.unidade_id)?.nome || 'N/A';
                  
                  return (
                    <tr key={a.id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[150px]">
                          {a.nome || `WhatsApp ${(a.telefone || '').slice(-4)}`}
                        </div>
                        <div className="text-xs text-muted-foreground">{a.telefone}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="truncate text-muted-foreground">
                          {a.ultima_mensagem || '(sem mensagens)'}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {a.ultima_interacao_at &&
                          formatDistanceToNow(new Date(a.ultima_interacao_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                      </td>
                      <td className="px-4 py-3 truncate max-w-[120px]">{unidadeNome}</td>
                      <td className="px-4 py-3">
                        {a.ultima_role === 'user' && !vinculado ? (
                          <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/20">
                            Sem resposta
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize">{a.status}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {matriculado ? (
                          <Badge className="bg-primary/15 text-primary border-primary/30">
                            Matriculado
                          </Badge>
                        ) : vinculado ? (
                          <Badge className="bg-green-500/15 text-green-700 border-green-500/30">
                            Lead criado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Não vinculado</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => openDrawer(a)} title="Ver Histórico">
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          {vinculado ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/lead/${a.lead_id}`)}
                              className="gap-1"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Ver Lead
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => openModal(a)} className="gap-1">
                              <UserPlus className="w-4 h-4" />
                              Transformar em Lead
                            </Button>
                          )}
                          {isAdmin && !vinculado && (
                            <Button size="icon" variant="ghost" onClick={() => arquivar(a)} title="Arquivar">
                              <Archive className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Drawer com histórico */}
      <Sheet open={!!drawerAtend} onOpenChange={(o) => !o && setDrawerAtend(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{drawerAtend?.nome || 'Conversa WhatsApp'}</SheetTitle>
            <SheetDescription>{drawerAtend?.telefone}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-2 flex flex-col">
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : mensagens.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sem mensagens registradas.
              </p>
            ) : (
              mensagens.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-muted self-start'
                      : 'bg-primary text-primary-foreground self-end ml-auto'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                  <p className="text-[10px] opacity-70 mt-1">
                    {new Date(m.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal transformar em lead */}
      <Dialog open={!!modalAtend} onOpenChange={(o) => !o && setModalAtend(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transformar em Lead</DialogTitle>
            <DialogDescription>
              A conversa será vinculada ao lead criado e aparecerá no Funil de Vendas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={formNome} onChange={(e) => setFormNome(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={modalAtend?.telefone || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Unidade de destino</Label>
              <Select value={formUnidade} onValueChange={setFormUnidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />

                </SelectTrigger>
                <SelectContent>
                  {unidadesPermitidas.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fonte</Label>
              <Select value={formOrigem} onValueChange={setFormOrigem}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              {unidadeUsers.length > 0 ? (
                <Select value={formResponsavel} onValueChange={setFormResponsavel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidadeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.name}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={formResponsavel}
                  onChange={(e) => setFormResponsavel(e.target.value.toUpperCase())}
                  placeholder="Nome do responsável"
                />
              )}
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                value={formObservacao}
                onChange={(e) => setFormObservacao(e.target.value)}
                placeholder="Nota inicial sobre a conversa…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAtend(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={transformarEmLead} disabled={saving || !formNome.trim() || !formUnidade}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar e criar lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
