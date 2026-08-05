import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Send, RefreshCw, ArrowLeft, Eye, Activity, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  grupo_anamnese_id: string;
  grupo_anamnese_nome: string;
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
  const [groupSearch, setGroupSearch] = useState('');
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [health, setHealth] = useState<any | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-health');
      if (error) throw error;
      setHealth(data);
    } catch (e: any) {
      toast.error('Falha ao carregar saúde: ' + (e?.message ?? ''));
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadHealth();
    const t = setInterval(loadHealth, 60_000);
    return () => clearInterval(t);
  }, [isAdmin]);

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
          grupo_anamnese_id: r?.grupo_anamnese_id ?? '',
          grupo_anamnese_nome: r?.grupo_anamnese_nome ?? '',
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
      grupo_anamnese_id: r.grupo_anamnese_id || null,
      grupo_anamnese_nome: r.grupo_anamnese_nome || null,
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

      {/* ============= Saúde do Chip ============= */}
      <Card className="border-2">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <Activity className="w-4 h-4" />
            Saúde dos Chips Z-API
            {(['comercial', 'operacional'] as const).map((ch) => {
              const st = health?.zapiByChannel?.[ch];
              const label = ch === 'comercial' ? 'EVO Comercial' : 'EVO Operacional';
              if (!st) {
                return health?.zapi ? null : (
                  <Badge key={ch} variant="outline">{label}: —</Badge>
                );
              }
              if (!st.configured) {
                return <Badge key={ch} variant="outline">{label}: não configurado</Badge>;
              }
              return st.connected ? (
                <Badge key={ch} variant="default" className="bg-green-600 hover:bg-green-700">
                  {label}: Conectado
                </Badge>
              ) : (
                <Badge key={ch} variant="destructive">{label}: Desconectado</Badge>
              );
            })}
            {/* Fallback (legado): se backend ainda não responder zapiByChannel */}
            {!health?.zapiByChannel && health?.zapi && (
              health.zapi.connected ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">Conectado</Badge>
              ) : (
                <Badge variant="destructive">Desconectado</Badge>
              )
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadHealth} disabled={healthLoading}>
            {healthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Total 24h</div>
              <div className="text-2xl font-bold">{health?.totais24?.total ?? '—'}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-600" /> Sucesso
              </div>
              <div className="text-2xl font-bold text-green-600">{health?.totais24?.sucesso ?? '—'}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <XCircle className="w-3 h-3 text-destructive" /> Erros
              </div>
              <div className="text-2xl font-bold text-destructive">{health?.totais24?.erros ?? '—'}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-500" /> Pulados
              </div>
              <div className="text-2xl font-bold text-amber-500">{health?.totais24?.skips ?? '—'}</div>
            </div>
          </div>

          {health?.porFuncao24 && Object.keys(health.porFuncao24).length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">ENVIOS POR FUNÇÃO (24h)</div>
              <div className="space-y-1 text-sm">
                {Object.entries(health.porFuncao24).map(([fn, st]: any) => (
                  <div key={fn} className="flex items-center justify-between py-1 border-b last:border-b-0">
                    <span className="font-mono text-xs">{fn}</span>
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-600">✓ {st.ok}</span>
                      <span className="text-destructive">✗ {st.err}</span>
                      <span className="text-amber-500">⏭ {st.skip}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {health?.serie7d && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">ÚLTIMOS 7 DIAS</div>
              <div className="flex items-end gap-1">
                {(() => {
                  const days: any[] = [];
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
                    days.push({ d, ...(health.serie7d[d] ?? { ok: 0, err: 0 }) });
                  }
                  const max = Math.max(1, ...days.map((x) => x.ok + x.err));
                  return days.map((x) => (
                    <div key={x.d} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-muted rounded-sm flex flex-col-reverse overflow-hidden" style={{ height: '60px' }}>
                        <div className="bg-green-600 w-full" style={{ height: `${(x.ok / max) * 100}%` }} title={`${x.ok} sucesso`} />
                        <div className="bg-destructive w-full" style={{ height: `${(x.err / max) * 100}%` }} title={`${x.err} erros`} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{x.d.slice(5)}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {health?.ultimosErros?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">ÚLTIMOS ERROS (24h)</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {health.ultimosErros.map((e: any, i: number) => (
                  <div key={i} className="text-xs border-l-2 border-destructive pl-2 py-1">
                    <div className="font-mono">{e.funcao}{e.destino ? ` → ${e.destino}` : ''}</div>
                    <div className="text-muted-foreground truncate" title={e.erro}>{e.erro}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(e.em).toLocaleString('pt-BR')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============= Painel Unificado — Envios de Hoje (Cronograma + Rotinas) ============= */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Operacional Hoje — Cronograma + Rotinas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['cronograma', 'rotinas', 'outros'] as const).map((cat) => {
              const r = health?.resumoHoje?.[cat] ?? { ok: 0, err: 0, skip: 0, total: 0 };
              const labels = { cronograma: '📅 Cronograma', rotinas: '🔄 Rotinas', outros: '✉️ Outros' };
              return (
                <div key={cat} className="border rounded-lg p-3">
                  <div className="text-xs font-semibold text-muted-foreground">{labels[cat]}</div>
                  <div className="text-2xl font-bold">{r.total}</div>
                  <div className="flex gap-2 text-xs mt-1">
                    <span className="text-green-600">✓ {r.ok}</span>
                    <span className="text-destructive">✗ {r.err}</span>
                    <span className="text-amber-500">⏭ {r.skip}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {(['cronograma', 'rotinas'] as const).map((cat) => {
            const items: any[] = health?.enviosHoje?.[cat] ?? [];
            if (items.length === 0) return (
              <div key={cat}>
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase">{cat}</div>
                <div className="text-sm text-muted-foreground italic">Nenhum envio hoje.</div>
              </div>
            );
            return (
              <div key={cat}>
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase">{cat} ({items.length})</div>
                <div className="space-y-1 max-h-64 overflow-y-auto border rounded-md">
                  {items.map((e, i) => {
                    const hora = new Date(e.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
                    const statusIcon = e.skip ? '⏭' : e.sucesso ? '✓' : '✗';
                    const statusColor = e.skip ? 'text-amber-500' : e.sucesso ? 'text-green-600' : 'text-destructive';
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 border-b last:border-b-0">
                        <span className={`font-bold ${statusColor}`}>{statusIcon}</span>
                        <span className="font-mono w-12">{hora}</span>
                        <span className="font-mono text-muted-foreground truncate flex-1" title={e.funcao}>{e.funcao}</span>
                        <span className="font-mono text-muted-foreground truncate max-w-[140px]" title={e.destino}>{e.destino || '—'}</span>
                        {e.erro && <span className="text-destructive truncate max-w-[200px]" title={e.erro}>{e.erro}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
                <div className="grid md:grid-cols-3 gap-4">
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
                            setGroupSearch('');
                          }}
                        >
                          <SelectTrigger className="h-9 w-[140px] shrink-0"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                          <SelectContent className="max-h-72 overflow-y-auto w-80">
                            <div className="p-2 sticky top-0 bg-popover z-10">
                              <Input
                                placeholder="Pesquisar grupo..."
                                value={groupSearch}
                                onChange={(e) => setGroupSearch(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus={false}
                              />
                            </div>
                            {(() => {
                              const q = groupSearch.trim().toLowerCase();
                              const filtered = q
                                ? groups.filter((g) => (g.name || '').toLowerCase().includes(q) || g.phone.toLowerCase().includes(q))
                                : groups;
                              if (filtered.length === 0) return <div className="px-2 py-3 text-sm text-muted-foreground text-center">Nenhum grupo encontrado</div>;
                              return filtered.map((g) => (
                                <SelectItem key={g.phone} value={g.phone}>
                                  <span className="truncate">{g.name || g.phone}</span>
                                </SelectItem>
                              ));
                            })()}
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

                  {/* Grupo Anamnese */}
                  <div className="space-y-2 border rounded-lg p-3">
                    <Label className="text-sm font-semibold">Grupo — Respostas de Anamnese</Label>
                    <div className="flex gap-1">
                      <Input
                        value={r.grupo_anamnese_id}
                        onChange={(e) => update(u.id, { grupo_anamnese_id: e.target.value.trim() })}
                        placeholder="120363xxxxxxxxxxx@g.us"
                        className="font-mono text-sm h-9 flex-1"
                      />
                      {groups.length > 0 && (
                        <Select
                          value={r.grupo_anamnese_id || undefined}
                          onValueChange={(v) => {
                            const g = groups.find((x) => x.phone === v);
                            update(u.id, { grupo_anamnese_id: v, grupo_anamnese_nome: r.grupo_anamnese_nome || g?.name || '' });
                            setGroupSearch('');
                          }}
                        >
                          <SelectTrigger className="h-9 w-[140px] shrink-0"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                          <SelectContent className="max-h-72 overflow-y-auto w-80">
                            <div className="p-2 sticky top-0 bg-popover z-10">
                              <Input
                                placeholder="Pesquisar grupo..."
                                value={groupSearch}
                                onChange={(e) => setGroupSearch(e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            {(() => {
                              const q = groupSearch.trim().toLowerCase();
                              const filtered = q
                                ? groups.filter((g) => (g.name || '').toLowerCase().includes(q) || g.phone.toLowerCase().includes(q))
                                : groups;
                              if (filtered.length === 0) return <div className="px-2 py-3 text-sm text-muted-foreground text-center">Nenhum grupo encontrado</div>;
                              return filtered.map((g) => (
                                <SelectItem key={g.phone} value={g.phone}>
                                  <span className="truncate">{g.name || g.phone}</span>
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <Input
                      value={r.grupo_anamnese_nome}
                      onChange={(e) => update(u.id, { grupo_anamnese_nome: e.target.value })}
                      placeholder="Apelido (ex: Anamnese ZN)"
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">As respostas das anamneses preenchidas pela recepção vão para este grupo.</p>
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
