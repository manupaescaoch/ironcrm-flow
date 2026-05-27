import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Send, RefreshCw, ArrowLeft, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Unidade { id: string; nome: string }
interface ConfigRow {
  unidade_id: string;
  grupo_fu_id: string;
  grupo_fu_nome: string;
  telefone_recepcao: string;
  ativo: boolean;
}
interface ZapiGroup { phone: string; name?: string }

export default function WhatsAppComercial() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [rows, setRows] = useState<Record<string, ConfigRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingFU, setTestingFU] = useState<string | null>(null);
  const [testingRec, setTestingRec] = useState<string | null>(null);
  const [groups, setGroups] = useState<ZapiGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [{ data: u }, { data: c }] = await Promise.all([
        supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('unidade_whatsapp_config').select('*'),
      ]);
      setUnidades((u ?? []) as Unidade[]);
      const map: Record<string, ConfigRow> = {};
      (u ?? []).forEach((un: any) => {
        const r = (c ?? []).find((x: any) => x.unidade_id === un.id);
        map[un.id] = {
          unidade_id: un.id,
          grupo_fu_id: r?.grupo_fu_id ?? '',
          grupo_fu_nome: r?.grupo_fu_nome ?? '',
          telefone_recepcao: r?.telefone_recepcao ?? '',
          ativo: r?.ativo ?? true,
        };
      });
      setRows(map);
      setLoading(false);
    })();
  }, [isAdmin]);

  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-whatsapp-groups');
      if (error) throw error;
      if (Array.isArray(data)) setGroups(data);
    } catch (e: any) {
      toast.error('Erro ao listar grupos: ' + (e?.message ?? ''));
    } finally {
      setLoadingGroups(false);
    }
  };

  const update = (id: string, patch: Partial<ConfigRow>) => {
    setRows((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  };

  const salvar = async (id: string) => {
    setSavingId(id);
    const r = rows[id];
    const { error } = await supabase.from('unidade_whatsapp_config').upsert({
      unidade_id: id,
      grupo_fu_id: r.grupo_fu_id || null,
      grupo_fu_nome: r.grupo_fu_nome || null,
      telefone_recepcao: r.telefone_recepcao.replace(/\D/g, '') || null,
      ativo: r.ativo,
    }, { onConflict: 'unidade_id' });
    setSavingId(null);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Configuração salva');
  };

  const testarFU = async (id: string, dry: boolean) => {
    setTestingFU(id);
    try {
      const { data, error } = await supabase.functions.invoke('send-fu-digest-comercial', {
        body: { unidade_id: id, dry_run: dry },
      });
      if (error) throw error;
      const r = (data as any)?.results?.[0];
      if (dry && r?.preview) {
        setPreview({ title: 'Pré-visualização — Digest de FU', content: r.preview });
      } else if (r?.status === 'sent') {
        toast.success(`Digest enviado (${r.n} follow-ups)`);
      } else if (r?.status === 'empty') {
        toast.message('Nenhum follow-up pendente hoje.');
      } else if (r?.status === 'duplicate') {
        toast.warning('Já foi enviado hoje (idempotente).');
      } else {
        toast.warning('Resposta: ' + JSON.stringify(data));
      }
    } catch (e: any) {
      toast.error('Falha: ' + (e?.message ?? ''));
    } finally {
      setTestingFU(null);
    }
  };

  const testarRecepcao = async (id: string, dry: boolean) => {
    setTestingRec(id);
    try {
      const { data, error } = await supabase.functions.invoke('send-confirmacao-recepcao', {
        body: { unidade_id: id, dry_run: dry },
      });
      if (error) throw error;
      const r = (data as any)?.results?.[0];
      if (dry && r?.preview) {
        setPreview({ title: 'Pré-visualização — Confirmações p/ Recepção', content: r.preview });
      } else if (r?.status === 'sent') {
        toast.success(`Lista enviada (${(r.n24 ?? 0) + (r.n2 ?? 0)} confirmações)`);
      } else if (r?.status === 'empty') {
        toast.message('Nenhuma confirmação na janela agora.');
      } else {
        toast.warning('Resposta: ' + JSON.stringify(data));
      }
    } catch (e: any) {
      toast.error('Falha: ' + (e?.message ?? ''));
    } finally {
      setTestingRec(null);
    }
  };

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto py-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/operacional"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
          </Button>
          <h1 className="text-2xl font-bold">WhatsApp Comercial por Unidade</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGroups} disabled={loadingGroups}>
          {loadingGroups ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Listar grupos do WhatsApp
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Follow-ups:</strong> 1 lista por dia (seg-sex 09h BRT) postada no <strong>grupo</strong>. Humano dispara manualmente e marca como contatado na CRM.
          </p>
          <p>
            <strong>Confirmações experimentais:</strong> a cada 30 min, lista consolidada (24h e 2h antes) vai direto para o <strong>número da recepção</strong> da unidade. Recepção envia do número comercial dela.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        unidades.map((u) => {
          const r = rows[u.id];
          if (!r) return null;
          return (
            <Card key={u.id}>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{u.nome}</CardTitle>
                <div className="flex items-center gap-2">
                  <Switch checked={r.ativo} onCheckedChange={(v) => update(u.id, { ativo: v })} />
                  <span className="text-xs">Ativo</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Grupo FU */}
                  <div className="space-y-2 border rounded-lg p-3">
                    <Label className="text-sm font-semibold">Grupo Comercial — Follow-ups</Label>
                    <div className="flex gap-1">
                      <Input
                        value={r.grupo_fu_id}
                        onChange={(e) => update(u.id, { grupo_fu_id: e.target.value.trim() })}
                        placeholder="120363xxxxxxxxxxx@g.us"
                        className="font-mono text-sm h-9 flex-1"
                      />
                      {groups.length > 0 && (
                        <Select
                          value={r.grupo_fu_id || undefined}
                          onValueChange={(v) => {
                            const g = groups.find((x) => x.phone === v);
                            update(u.id, { grupo_fu_id: v, grupo_fu_nome: r.grupo_fu_nome || g?.name || '' });
                          }}
                        >
                          <SelectTrigger className="h-9 w-[140px] shrink-0"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                          <SelectContent className="max-h-72 overflow-y-auto">
                            {groups.map((g) => (
                              <SelectItem key={g.phone} value={g.phone}>
                                <span className="truncate">{g.name || g.phone}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <Input
                      value={r.grupo_fu_nome}
                      onChange={(e) => update(u.id, { grupo_fu_nome: e.target.value })}
                      placeholder="Apelido (ex: Comercial ZN)"
                      className="h-9"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => testarFU(u.id, true)} disabled={testingFU === u.id}>
                        <Eye className="w-4 h-4 mr-1" /> Pré-visualizar
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => testarFU(u.id, false)} disabled={testingFU === u.id || !r.grupo_fu_id}>
                        {testingFU === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                        Enviar agora
                      </Button>
                    </div>
                  </div>

                  {/* Telefone Recepção */}
                  <div className="space-y-2 border rounded-lg p-3">
                    <Label className="text-sm font-semibold">Telefone da Recepção — Confirmações</Label>
                    <Input
                      value={r.telefone_recepcao}
                      onChange={(e) => update(u.id, { telefone_recepcao: e.target.value })}
                      placeholder="Ex: 5511999999999"
                      type="tel"
                      className="font-mono h-9"
                    />
                    <p className="text-xs text-muted-foreground">Use formato internacional sem espaços (55 + DDD + número).</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => testarRecepcao(u.id, true)} disabled={testingRec === u.id}>
                        <Eye className="w-4 h-4 mr-1" /> Pré-visualizar
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => testarRecepcao(u.id, false)} disabled={testingRec === u.id || !r.telefone_recepcao}>
                        {testingRec === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                        Enviar agora
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={() => salvar(u.id)} disabled={savingId === u.id}>
                    {savingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Salvar configurações
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>Conteúdo que seria enviado agora. Nada foi disparado.</DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md max-h-[60vh] overflow-auto">
            {preview?.content}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
