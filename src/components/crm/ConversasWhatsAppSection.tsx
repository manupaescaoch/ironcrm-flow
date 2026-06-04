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
import { Loader2, MessageCircle, UserPlus, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Atendimento {
  id: string;
  contact_name: string | null;
  phone: string | null;
  unidade_id: string;
  last_message_at: string | null;
  status_conversa: string;
  lead_id: string | null;
  is_linked_to_lead: boolean;
  last_message_text?: string | null;
  last_message_direction?: string | null;
  lead?: {
    id: string;
    nome: string;
    is_matriculado: boolean;
    status_funil: string;
  } | null;
}

interface Mensagem {
  id: string;
  direction: string;
  message_text: string;
  received_at: string;
}

const ORIGENS = [
  'WhatsApp',
  'Instagram',
  'Tráfego Pago',
  'Indicação',
  'Visita Presencial',
];

type TabKey = 'nao_vinculadas' | 'vinculadas' | 'todas';

interface Props {
  onCountsChange?: (counts: { total: number; naoVinculadas: number; semResposta: number; ativas: number; totalMensagens?: number }) => void;
  onLeadCreated?: () => void;
}

export function ConversasWhatsAppSection({ onCountsChange, onLeadCreated }: Props) {
  const { user } = useAuth();
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
  const [formOrigem, setFormOrigem] = useState('WhatsApp');
  const [formResponsavel, setFormResponsavel] = useState<string>('');
  const [formObservacao, setFormObservacao] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const fetchInbox = useCallback(async () => {
    if (!unidadeAtual) return;
    setLoading(true);

    try {
      let query = supabase
        .from('whatsapp_conversations')
        .select(`
          id, 
          contact_name, 
          phone, 
          unidade_id, 
          last_message_at, 
          status_conversa, 
          lead_id, 
          is_linked_to_lead, 
          last_message_text, 
          last_message_direction, 
          first_inbound_at, 
          first_response_at,
          is_cliente,
          lead:leads(id, nome, is_matriculado, status_funil)
        `)
        .order('last_message_at', { ascending: false })
        .limit(50);

      // If a specific unit is selected (not "all/inbox")
      if (unidadeAtual.id !== '00000000-0000-0000-0000-000000000000') {
        query = query.eq('unidade_id', unidadeAtual.id);
      }

      const { data: atends, error } = await query;
      
      if (error) {
        console.error('Error fetching conversations:', error);
        toast({ title: 'Erro ao carregar conversas', description: error.message, variant: 'destructive' });
      } else {
        setAtendimentos((atends as unknown as Atendimento[]) || []);
        
        // Update counts
        if (onCountsChange) {
          const mapped = (atends as unknown as Atendimento[]) || [];
          const total = mapped.length;
          const naoVinculadas = mapped.filter((a) => !a.lead_id).length;
          const semResposta = mapped.filter((a) => a.last_message_direction === 'inbound').length;
          const ativas = mapped.length;
          onCountsChange({ total, naoVinculadas, semResposta, ativas });
        }
      }
    } catch (err) {
      console.error('Unexpected error in fetchInbox:', err);
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual, onCountsChange]);

  useEffect(() => {
    fetchInbox();
    
    // Subscribe to REALTIME updates for both inserts and updates
    const channel = supabase
      .channel('whatsapp-conversations-realtime')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'whatsapp_conversations' }, 
        (payload) => {
          console.log('Realtime update received:', payload);
          fetchInbox();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

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
        (a.contact_name || '').toLowerCase().includes(q) ||
        (a.phone || '').includes(q) ||
        (a.last_message_text || '').toLowerCase().includes(q),
    );
  }, [atendimentos, search, tab]);

  const openDrawer = async (atend: Atendimento) => {
    setDrawerAtend(atend);
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('id, direction, message_text, received_at')
      .eq('phone', atend.phone)
      .order('received_at', { ascending: true })
      .limit(100);
    setMensagens((data || []) as Mensagem[]);
    setLoadingMsgs(false);
  };

  const openModal = (atend: Atendimento) => {
    setModalAtend(atend);
    setFormNome((atend.contact_name || `WhatsApp ${(atend.phone || '').slice(-4)}`).toUpperCase());
    setFormUnidade(unidadeAtual?.id === '00000000-0000-0000-0000-000000000000' ? '' : (unidadeAtual?.id || atend.unidade_id || ''));
    setFormOrigem('WhatsApp');
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

    const telDigits = (modalAtend.phone || '').replace(/\D/g, '');
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
        .from('whatsapp_conversations')
        .update({ lead_id: dup.id, unidade_id: formUnidade, is_linked_to_lead: true, status_conversa: 'convertido' })
        .eq('id', modalAtend.id);
      
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
        telefone_normalizado: telDigits,
        origem: formOrigem,
        fonte: 'WhatsApp',
        status_funil: 'novo',
        status_conversa: 'convertido',
        ultima_interacao_at: new Date().toISOString(),
        unidade_id: formUnidade,
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
      .from('whatsapp_conversations')
      .update({ lead_id: novoLead.id, unidade_id: formUnidade, is_linked_to_lead: true, status_conversa: 'convertido' })
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

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="w-5 h-5" />
              Conversas do WhatsApp em tempo real
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Números que chegaram pelo WhatsApp e ainda podem ser convertidos em cliente
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
          <div className="py-20 text-center text-muted-foreground bg-muted/10">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <h3 className="text-lg font-medium text-foreground">Aguardando novas mensagens...</h3>
            <p className="text-sm max-w-xs mx-auto">Nenhuma conversa encontrada para os filtros selecionados no momento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-y">
                <tr>
                  <th className="px-4 py-3 text-left">Contato</th>
                  <th className="px-4 py-3 text-left">Última mensagem</th>
                  <th className="px-4 py-3 text-left">Tempo</th>
                  <th className="px-4 py-3 text-left">Unidade</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Vínculo</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((a) => {
                  const vinculado = !!a.lead_id;
                  const matriculado = a.lead?.is_matriculado;
                  const unidadeNome = unidadesPermitidas.find(u => u.id === a.unidade_id)?.nome || 'Não definida';
                  
                  return (
                    <tr key={a.id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[150px]">
                          {a.contact_name || `WhatsApp ${(a.phone || '').slice(-4)}`}
                        </div>
                        <div className="text-xs text-muted-foreground">{a.phone}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="truncate text-muted-foreground">
                          {a.last_message_text || '(sem mensagens)'}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {a.last_message_at &&
                          formatDistanceToNow(new Date(a.last_message_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                      </td>
                      <td className="px-4 py-3 truncate max-w-[120px]">{unidadeNome}</td>
                      <td className="px-4 py-3">
                        {a.is_cliente || matriculado ? (
                          <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30">
                            Encerrado / Cliente
                          </Badge>
                        ) : a.last_message_direction === 'inbound' ? (
                          <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/20">
                            Aguardando resposta
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize">
                            {a.status_conversa === 'convertido' ? 'Em andamento' : (a.status_conversa || 'Em andamento')}
                          </Badge>
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
                          {matriculado || a.is_cliente ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/lead/${a.lead_id}`)}
                              className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Ver Cliente
                            </Button>
                          ) : vinculado ? (
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
                            <Button size="sm" onClick={() => openModal(a)} className="gap-1 bg-green-600 hover:bg-green-700">
                              <UserPlus className="w-4 h-4" />
                              Converter em Cliente
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

      <Sheet open={!!drawerAtend} onOpenChange={(o) => !o && setDrawerAtend(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{drawerAtend?.contact_name || 'Conversa WhatsApp'}</SheetTitle>
            <SheetDescription>{drawerAtend?.phone}</SheetDescription>
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
                    m.direction === 'inbound'
                      ? 'bg-muted self-start'
                      : 'bg-primary text-primary-foreground self-end ml-auto'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.message_text}</p>
                  <p className="text-[10px] opacity-70 mt-1">
                    {new Date(m.received_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!modalAtend} onOpenChange={(o) => !o && setModalAtend(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converter em Cliente</DialogTitle>
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
              <Input value={modalAtend?.phone || ''} disabled />
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
            <div className="md:col-span-2">
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
              Confirmar conversão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
