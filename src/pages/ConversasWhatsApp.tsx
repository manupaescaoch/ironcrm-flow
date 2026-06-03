import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { Loader2, MessageCircle, UserPlus, Archive, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Atendimento {
  id: string;
  nome: string | null;
  telefone: string | null;
  unidade_id: string;
  ultima_interacao_at: string | null;
  status: string;
  ultima_mensagem?: string | null;
}

interface Mensagem {
  id: string;
  role: string;
  conteudo: string;
  created_at: string;
}

interface Unidade {
  id: string;
  nome: string;
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

export default function ConversasWhatsApp() {
  const { user, isAdmin } = useAuth();
  const { unidadesPermitidas } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [search, setSearch] = useState('');

  const [drawerAtend, setDrawerAtend] = useState<Atendimento | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [modalAtend, setModalAtend] = useState<Atendimento | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formUnidade, setFormUnidade] = useState<string>('');
  const [formOrigem, setFormOrigem] = useState('WHATSAPP');
  const [saving, setSaving] = useState(false);

  const fetchInbox = async () => {
    setLoading(true);
    // 1) Atendimentos sem lead vinculado
    const { data: atends, error } = await supabase
      .from('agente_atendimentos')
      .select('id, nome, telefone, unidade_id, ultima_interacao_at, status')
      .is('lead_id', null)
      .neq('status', 'arquivado')
      .order('ultima_interacao_at', { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: 'Erro ao carregar conversas', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // 2) Pega a última mensagem de cada atendimento
    const ids = (atends || []).map((a) => a.id);
    let preview: Record<string, string> = {};
    if (ids.length) {
      const { data: msgs } = await supabase
        .from('agente_mensagens')
        .select('atendimento_id, conteudo, created_at')
        .in('atendimento_id', ids)
        .order('created_at', { ascending: false });
      for (const m of msgs || []) {
        if (!preview[m.atendimento_id]) preview[m.atendimento_id] = m.conteudo;
      }
    }

    setAtendimentos(
      (atends || []).map((a) => ({ ...a, ultima_mensagem: preview[a.id] ?? null })),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchInbox();
    // realtime
    const channel = supabase
      .channel('conversas-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agente_atendimentos' },
        () => fetchInbox(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agente_mensagens' },
        () => fetchInbox(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return atendimentos;
    return atendimentos.filter(
      (a) =>
        (a.nome || '').toLowerCase().includes(q) ||
        (a.telefone || '').includes(q) ||
        (a.ultima_mensagem || '').toLowerCase().includes(q),
    );
  }, [atendimentos, search]);

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
    setFormUnidade(unidadesPermitidas[0]?.id || atend.unidade_id);
    setFormOrigem('WHATSAPP');
  };

  const transformarEmLead = async () => {
    if (!modalAtend || !formNome.trim() || !formUnidade) return;
    setSaving(true);

    // Verificar duplicidade por telefone normalizado
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
      return;
    }

    const { data: novoLead, error: insertErr } = await supabase
      .from('leads')
      .insert({
        nome: formNome.trim().toUpperCase(),
        telefone: modalAtend.telefone || '',
        origem: formOrigem,
        fonte: 'WHATSAPP',
        status_funil: 'novo',
        status_conversa: 'aguardando_resposta',
        ultima_interacao_at: new Date().toISOString(),
        unidade_id: formUnidade,
        atendimento_id: modalAtend.id,
        ativo: true,
        is_matriculado: false,
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

    toast({ title: 'Lead criado', description: `${formNome} foi adicionado ao funil.` });
    setSaving(false);
    setModalAtend(null);
    fetchInbox();
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
    <Layout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MessageCircle className="w-7 h-7" />
              Conversas WhatsApp
            </h1>
            <p className="text-muted-foreground text-sm">
              Caixa de entrada de números recebidos pelo WhatsApp ainda não vinculados a um lead.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por nome, telefone ou mensagem…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72"
            />
            <Button variant="outline" size="icon" onClick={fetchInbox} title="Atualizar">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma conversa pendente</p>
              <p className="text-sm">Novas mensagens recebidas pelo WhatsApp aparecerão aqui.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((a) => (
                <li
                  key={a.id}
                  className="p-4 hover:bg-muted/30 transition flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">
                        {a.nome || `WhatsApp ${(a.telefone || '').slice(-4)}`}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {a.telefone}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {a.ultima_mensagem || '(sem mensagens)'}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {a.ultima_interacao_at &&
                      formatDistanceToNow(new Date(a.ultima_interacao_at), {
                        locale: ptBR,
                        addSuffix: true,
                      })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openDrawer(a)}>
                      Ver conversa
                    </Button>
                    <Button size="sm" onClick={() => openModal(a)} className="gap-1">
                      <UserPlus className="w-4 h-4" />
                      Transformar em Lead
                    </Button>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => arquivar(a)}
                        title="Arquivar"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Drawer com histórico */}
      <Sheet open={!!drawerAtend} onOpenChange={(o) => !o && setDrawerAtend(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{drawerAtend?.nome || 'Conversa WhatsApp'}</SheetTitle>
            <SheetDescription>{drawerAtend?.telefone}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-2">
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
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={modalAtend?.telefone || ''} disabled />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={formUnidade} onValueChange={setFormUnidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidadesPermitidas.map((u: Unidade) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origem</Label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAtend(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={transformarEmLead} disabled={saving || !formNome.trim() || !formUnidade}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
