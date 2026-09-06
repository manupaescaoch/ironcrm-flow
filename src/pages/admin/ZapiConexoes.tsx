import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2, RefreshCw, Send, ArrowLeft, CheckCircle2, XCircle, KeyRound, ShieldCheck,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Channel = 'comercial' | 'operacional' | 'operacional2';

const CHANNELS: Channel[] = ['comercial', 'operacional', 'operacional2'];

interface ChannelHealth {
  connected: boolean;
  configured: boolean;
  instanceIdMasked: string | null;
  checkedAt: string;
  raw?: any;
}

const SECRETS: Record<Channel, string[]> = {
  comercial: ['ZAPI_COMERCIAL_INSTANCE_ID', 'ZAPI_COMERCIAL_TOKEN', 'ZAPI_COMERCIAL_CLIENT_TOKEN'],
  operacional: ['DAPI_API_KEY', 'DAPI_SESSION_ID'],
  operacional2: ['DAPI_OPERACIONAL_API_KEY', 'DAPI_OPERACIONAL_SESSION_ID'],
};

const TITLE: Record<Channel, string> = {
  comercial: 'EVO Comercial',
  operacional: 'DAPI MANU',
  operacional2: 'DAPI OPERACIONAL',
};

const DESC: Record<Channel, string> = {
  comercial: 'Chip usado para leads e alunos (follow-ups, confirmações, recepção).',
  operacional: 'Chip atual da equipe interna (rotinas, tarefas, alertas operacionais).',
  operacional2: 'Novo chip da operação. Conecte aqui e depois escolhemos, item por item, o que passa por ele.',
};

function maskPhone(p: string): string {
  const d = p.replace(/\D/g, '');
  if (d.length < 4) return '***';
  return d.slice(0, 4) + '***' + d.slice(-2);
}

export default function ZapiConexoes() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [health, setHealth] = useState<Record<Channel, ChannelHealth | null>>({
    comercial: null, operacional: null, operacional2: null,
  });
  const [loadingCh, setLoadingCh] = useState<Record<Channel, boolean>>({
    comercial: false, operacional: false, operacional2: false,
  });
  const [lastTest, setLastTest] = useState<Record<Channel, { ok: boolean; at: string; phone: string } | null>>({
    comercial: null, operacional: null, operacional2: null,
  });
  const [testOpen, setTestOpen] = useState<Channel | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [credOpen, setCredOpen] = useState<Channel | null>(null);

  const loadChannel = async (ch: Channel) => {
    setLoadingCh((s) => ({ ...s, [ch]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('zapi-health', {
        body: undefined,
        // query via URL param
      });
      // invoke doesn't expose query string easily — use direct fetch
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-health?channel=${ch}`;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const info = j?.zapiByChannel?.[ch];
      setHealth((s) => ({ ...s, [ch]: info ?? null }));
      void data; void error;
    } catch (e: any) {
      toast.error(`Falha ao consultar canal ${ch}: ${e?.message ?? ''}`);
    } finally {
      setLoadingCh((s) => ({ ...s, [ch]: false }));
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    CHANNELS.forEach((c) => loadChannel(c));
    const t = setInterval(() => {
      CHANNELS.forEach((c) => loadChannel(c));
    }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const runTest = async () => {
    if (!testOpen) return;
    const digits = testPhone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      toast.error('Telefone inválido. Use DDD + número.');
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-zapi-test', {
        body: {
          phone: digits,
          channel: testOpen,
          message: `🔧 Teste de conexão Z-API (${TITLE[testOpen]}) — ${new Date().toLocaleString('pt-BR')}`,
        },
      });
      if (error) throw error;
      const ok = !!data?.ok;
      setLastTest((s) => ({
        ...s,
        [testOpen]: { ok, at: new Date().toISOString(), phone: maskPhone(digits) },
      }));
      if (ok) {
        toast.success('Mensagem enviada com sucesso.');
        setTestOpen(null);
        setTestPhone('');
      } else {
        toast.error('Envio falhou. Verifique o status do chip.');
      }
    } catch (e: any) {
      toast.error('Erro no teste: ' + (e?.message ?? ''));
    } finally {
      setTesting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const renderCard = (ch: Channel) => {
    const h = health[ch];
    const loading = loadingCh[ch];
    const test = lastTest[ch];
    const connectedBadge = h?.connected
      ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Conectado</Badge>
      : h?.configured
        ? <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Desconectado</Badge>
        : <Badge variant="outline">Sem credenciais</Badge>;

    return (
      <Card key={ch}>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{TITLE[ch]}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{DESC[ch]}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => loadChannel(ch)} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Status do chip</div>
              <div className="mt-1">{connectedBadge}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">{ch === 'comercial' ? 'Instance ID' : 'Sessão'}</div>
              <div className="mt-1 font-mono text-xs">
                {h?.instanceIdMasked ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Canal / ambiente</div>
              <div className="mt-1 uppercase font-medium">{ch}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Webhook</div>
              <div className="mt-1">
                <Badge variant="outline" className="text-xs">rotina-whatsapp-response</Badge>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Último check</div>
              <div className="mt-1 text-xs">
                {h?.checkedAt ? new Date(h.checkedAt).toLocaleTimeString('pt-BR') : '—'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Último teste</div>
              <div className="mt-1 text-xs">
                {test ? (
                  <span className={test.ok ? 'text-emerald-600' : 'text-destructive'}>
                    {test.ok ? '✓' : '✗'} {test.phone} · {new Date(test.at).toLocaleTimeString('pt-BR')}
                  </span>
                ) : '—'}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={() => { setTestOpen(ch); setTestPhone(''); }}
              disabled={!h?.configured}
            >
              <Send className="w-4 h-4 mr-2" />
              Testar envio
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCredOpen(ch)}>
              <KeyRound className="w-4 h-4 mr-2" />
              Atualizar credenciais
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
            <h1 className="text-2xl font-bold mt-2">Conexões de WhatsApp</h1>
            <p className="text-sm text-muted-foreground">
              Visualização e validação dos chips Comercial, DAPI MANU e DAPI OPERACIONAL. Credenciais permanecem no cofre seguro do Lovable Cloud.
            </p>
          </div>
          <Badge variant="outline" className="gap-1"><ShieldCheck className="w-3 h-3" /> Admin</Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {CHANNELS.map((c) => renderCard(c))}
        </div>

        {/* Test dialog */}
        <Dialog open={!!testOpen} onOpenChange={(o) => !o && setTestOpen(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Testar envio · {testOpen ? TITLE[testOpen] : ''}</DialogTitle>
              <DialogDescription>
                O envio é feito pela função <code className="text-xs">send-zapi-test</code> (somente admin) e fica registrado em auditoria com telefone mascarado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="test-phone">Telefone de destino</Label>
                <Input
                  id="test-phone"
                  placeholder="ex: 11999998888"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use seu próprio número ou um número interno de teste. Evite enviar para leads/alunos.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestOpen(null)} disabled={testing}>Cancelar</Button>
              <Button onClick={runTest} disabled={testing}>
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Credentials guidance dialog */}
        <Dialog open={!!credOpen} onOpenChange={(o) => !o && setCredOpen(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atualizar credenciais · {credOpen ? TITLE[credOpen] : ''}</DialogTitle>
              <DialogDescription>
                Por segurança, credenciais nunca são gravadas pelo app. Atualize-as diretamente no cofre do Lovable Cloud.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>Secrets deste canal:</p>
              <ul className="space-y-1">
                {(credOpen ? SECRETS[credOpen] : []).map((s) => (
                  <li key={s} className="font-mono text-xs bg-muted px-2 py-1 rounded">{s}</li>
                ))}
              </ul>
              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-medium">Como atualizar:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Abra o painel do projeto no Lovable.</li>
                  <li>Vá em <strong>Cloud → Settings → Secrets</strong>.</li>
                  <li>Localize o secret pelo nome exato listado acima.</li>
                  <li>Clique em <em>Update</em> e cole o novo valor obtido no painel da Z-API.</li>
                  <li>Volte aqui e clique em <em>Atualizar status</em> para validar a conexão.</li>
                </ol>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCredOpen(null)}>Fechar</Button>
              <Button onClick={() => { if (credOpen) loadChannel(credOpen); setCredOpen(null); }}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
