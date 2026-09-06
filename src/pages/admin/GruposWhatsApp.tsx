import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Send, RefreshCw, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { UNIDADES_FORMULARIO, getUnidadeLabelByValue } from '@/lib/formularioUnidades';

type FormularioKey = 'estagiario_lider' | 'coordenador_unidade' | 'coordenador_horario' | 'relatorio_comercial';

const FORMULARIOS: { key: FormularioKey; titulo: string }[] = [
  { key: 'estagiario_lider', titulo: 'Encerramento — Estagiário Líder' },
  { key: 'coordenador_unidade', titulo: 'Encerramento — Coordenador de Unidade' },
  { key: 'coordenador_horario', titulo: 'Encerramento — Coordenador de Horário' },
  { key: 'relatorio_comercial', titulo: 'Relatório Diário — Comercial' },
];

interface Linha {
  id?: string;
  formulario_key: FormularioKey;
  unidade: string;
  grupo_id: string;
  grupo_nome: string;
  ativo: boolean;
}

interface ZapiGroup { phone: string; name?: string }

export default function GruposWhatsApp() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [groups, setGroups] = useState<ZapiGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const { data } = await supabase.from('formulario_grupos_whatsapp').select('*');
      const map = new Map<string, any>();
      (data ?? []).forEach((r: any) => map.set(`${r.formulario_key}|${r.unidade}`, r));
      const linhasInit: Linha[] = [];
      FORMULARIOS.forEach((f) => UNIDADES_FORMULARIO.forEach((u) => {
        const k = `${f.key}|${u.value}`;
        const r = map.get(k);
        linhasInit.push({
          id: r?.id, formulario_key: f.key, unidade: u.value,
          grupo_id: r?.grupo_id ?? '', grupo_nome: r?.grupo_nome ?? '',
          ativo: r?.ativo ?? true,
        });
      }));
      setLinhas(linhasInit);
      setLoading(false);
    };
    load();
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

  const updateLinha = (idx: number, patch: Partial<Linha>) => {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const salvar = async (l: Linha) => {
    const key = `${l.formulario_key}|${l.unidade}`;
    setSavingKey(key);
    const { error } = await supabase
      .from('formulario_grupos_whatsapp')
      .upsert({
        formulario_key: l.formulario_key,
        unidade: l.unidade,
        grupo_id: l.grupo_id || null,
        grupo_nome: l.grupo_nome || null,
        ativo: l.ativo,
      }, { onConflict: 'formulario_key,unidade' });
    setSavingKey(null);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Configuração salva');
  };

  const testar = async (l: Linha) => {
    if (!l.grupo_id) { toast.error('Informe o ID do grupo antes de testar'); return; }
    const key = `${l.formulario_key}|${l.unidade}`;
    setTestingKey(key);
    // Envia mensagem de TESTE fixa — o servidor monta o conteúdo. O caller
    // não controla título, corpo nem grupo de destino.
    const { data, error } = await supabase.functions.invoke('notify-formulario-encerramento', {
      body: {
        tipo_formulario: l.formulario_key,
        unidade: l.unidade,
        mode: 'test',
      },
    });
    setTestingKey(null);
    if (error) { toast.error('Falha ao enviar: ' + error.message); return; }
    if ((data as any)?.sent) toast.success('Mensagem de teste enviada');
    else toast.warning('Função respondeu, mas não enviou: ' + JSON.stringify(data));
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
          <h1 className="text-2xl font-bold">Grupos WhatsApp por Formulário</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGroups} disabled={loadingGroups}>
          {loadingGroups ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Listar grupos do WhatsApp
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Cole o ID do grupo (formato <code>120363xxxxxxxx@g.us</code>) para cada formulário e unidade.
        Use "Listar grupos" para descobrir os IDs disponíveis na sua conta Z-API.
      </p>

      {groups.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Grupos disponíveis ({groups.length})</CardTitle>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou ID..."
              className="h-9 mt-2"
            />
          </CardHeader>
          <CardContent className="max-h-56 overflow-auto space-y-1 text-sm">
            {(() => {
              const q = search.trim().toLowerCase();
              const filtered = q
                ? groups.filter((g) => (g.name || '').toLowerCase().includes(q) || g.phone.toLowerCase().includes(q))
                : groups;
              if (filtered.length === 0) return <div className="text-muted-foreground py-2">Nenhum grupo encontrado.</div>;
              return filtered.map((g) => (
                <div key={g.phone} className="flex justify-between gap-3 border-b py-1">
                  <span className="font-medium truncate">{g.name || '(sem nome)'}</span>
                  <button
                    className="font-mono text-xs text-blue-600 hover:underline"
                    onClick={() => { navigator.clipboard.writeText(g.phone); toast.success('ID copiado'); }}
                  >
                    {g.phone}
                  </button>
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        FORMULARIOS.map((f) => (
          <Card key={f.key}>
            <CardHeader className="pb-3"><CardTitle className="text-base">{f.titulo}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {linhas.filter((l) => l.formulario_key === f.key).map((l) => {
                const idx = linhas.findIndex((x) => x.formulario_key === l.formulario_key && x.unidade === l.unidade);
                const key = `${l.formulario_key}|${l.unidade}`;
                return (
                  <div key={key} className="grid grid-cols-1 md:grid-cols-[120px_1fr_180px_auto_auto_auto] gap-2 items-center border rounded-lg p-3">
                    <div className="font-semibold text-sm">{getUnidadeLabelByValue(l.unidade)}</div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ID do grupo</Label>
                      <div className="flex gap-1">
                        <Input
                          value={l.grupo_id}
                          onChange={(e) => updateLinha(idx, { grupo_id: e.target.value.trim() })}
                          placeholder="120363xxxxxxxxxxx@g.us"
                          className="font-mono text-sm h-9 flex-1"
                        />
                        {groups.length > 0 && (
                          <Select
                            value={l.grupo_id || undefined}
                            onValueChange={(v) => {
                              const g = groups.find((x) => x.phone === v);
                              updateLinha(idx, { grupo_id: v, grupo_nome: l.grupo_nome || g?.name || '' });
                            }}
                          >
                            <SelectTrigger className="h-9 w-[140px] shrink-0">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
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
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Apelido (opcional)</Label>
                      <Input
                        value={l.grupo_nome}
                        onChange={(e) => updateLinha(idx, { grupo_nome: e.target.value })}
                        placeholder="Ex: Gestão ZN"
                        className="h-9"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={l.ativo} onCheckedChange={(v) => updateLinha(idx, { ativo: v })} />
                      <span className="text-xs">Ativo</span>
                    </div>
                    <Button size="sm" onClick={() => salvar(l)} disabled={savingKey === key}>
                      {savingKey === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => testar(l)} disabled={testingKey === key}>
                      {testingKey === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                      Testar
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
