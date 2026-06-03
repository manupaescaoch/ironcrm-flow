import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, Users, UserPlus, UserMinus, CheckCircle2, Target, Clock, DollarSign, PieChart, RefreshCw, Pencil } from 'lucide-react';
import { useGestaoOperacional, UnidadeKPIs, SeriesPoint, fetchUnidadeHistorico } from '@/hooks/useGestaoOperacional';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, startOfWeek } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

function Delta({ current, previous, asPercent = false, invertColors = false }: { current: number; previous: number; asPercent?: boolean; invertColors?: boolean }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Minus className="w-3 h-3" />—</span>;
  const diff = current - previous;
  const pct = previous === 0 ? 100 : Math.round((diff / previous) * 100);
  const up = diff > 0;
  const isGood = invertColors ? !up : up;
  if (diff === 0) return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Minus className="w-3 h-3" />0%</span>;
  return (
    <span className={`text-xs inline-flex items-center gap-1 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {asPercent ? `${diff > 0 ? '+' : ''}${diff}pp` : `${diff > 0 ? '+' : ''}${pct}%`}
    </span>
  );
}

function KPIBlock({ icon: Icon, label, value, sub, delta }: any) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground text-xs uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground">{sub}</span>
        {delta}
      </div>
    </div>
  );
}

function EditarMetasDialog({ k, onSaved }: { k: UnidadeKPIs; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metaAlunos, setMetaAlunos] = useState(k.meta_alunos_mes);
  const [evasao, setEvasao] = useState(k.meta?.evasao_pct_manual ?? 0);
  const [cac, setCac] = useState(k.meta?.cac_manual ?? 0);

  useEffect(() => {
    if (open) {
      setMetaAlunos(k.meta_alunos_mes);
      setEvasao(k.meta?.evasao_pct_manual ?? 0);
      setCac(k.meta?.cac_manual ?? 0);
    }
  }, [open, k]);

  const handleSave = async () => {
    setSaving(true);
    const payload = { meta_alunos_mes: metaAlunos, evasao_pct_manual: evasao, cac_manual: cac };
    let error;
    if (k.meta?.id) {
      ({ error } = await supabase.from('gestao_metas').update(payload).eq('id', k.meta.id));
    } else {
      ({ error } = await supabase.from('gestao_metas').insert({ unidade_id: k.unidade_id, ...payload }));
    }
    setSaving(false);
    if (error) { toast.error('Erro ao salvar meta: ' + error.message); return; }
    toast.success('Meta atualizada');
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Pencil className="w-3 h-3" /> Meta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Metas — {k.unidade_nome}</DialogTitle>
          <DialogDescription>Valores informados manualmente.</DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div>
            <Label className="text-xs">Meta de alunos no mês</Label>
            <Input type="number" value={metaAlunos} onChange={e => setMetaAlunos(+e.target.value)} autoFocus />
          </div>
          <div>
            <Label className="text-xs">Evasão do mês (%)</Label>
            <Input type="number" step="0.01" value={evasao} onChange={e => setEvasao(+e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">CAC do mês (R$)</Label>
            <Input type="number" step="0.01" value={cac} onChange={e => setCac(+e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function UnidadeCard({ k, onRefetch }: { k: UnidadeKPIs; onRefetch: () => void }) {

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(k.alunos_ativos);
  const [saving, setSaving] = useState(false);

  const [editingTicket, setEditingTicket] = useState(false);
  const [ticketValue, setTicketValue] = useState(k.ticket_medio_real);
  const [savingTicket, setSavingTicket] = useState(false);

  useEffect(() => { setValue(k.alunos_ativos); }, [k.alunos_ativos]);
  useEffect(() => { setTicketValue(k.ticket_medio_real); }, [k.ticket_medio_real]);

  const handleSave = async () => {
    if (!k.meta?.id) {
      toast.error('Meta da unidade não encontrada.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('gestao_metas')
      .update({ alunos_ativos_manual: value })
      .eq('id', k.meta.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Alunos ativos atualizado');
    setEditing(false);
    onRefetch();
  };

  const handleSaveTicket = async () => {
    if (!k.meta?.id) { toast.error('Meta da unidade não encontrada.'); return; }
    setSavingTicket(true);
    const { error } = await supabase
      .from('gestao_metas')
      .update({ ticket_medio_real: ticketValue })
      .eq('id', k.meta.id);
    setSavingTicket(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Ticket médio atualizado');
    setEditingTicket(false);
    onRefetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{k.unidade_nome}</span>
          <div className="flex items-center gap-2">
            {k.alertas.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {k.alertas.length}
              </Badge>
            )}
            <EditarMetasDialog k={k} onSaved={onRefetch} />
          </div>
        </CardTitle>
        <CardDescription>
          Capacidade {k.meta?.capacidade_alunos ?? '—'} alunos · Meta de ocupação {k.meta?.meta_ocupacao_pct ?? 80}%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground text-xs uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              Alunos Ativos
            </div>
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={value}
                  onChange={e => setValue(+e.target.value)}
                  className="h-8"
                  autoFocus
                />
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(k.alunos_ativos); }}>X</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-foreground">{k.alunos_ativos}</div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Editar</Button>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">informado manualmente</div>
          </div>
          <KPIBlock icon={UserPlus} label="Matrículas (Sem.)" value={k.matriculas_semana}
            sub={`Sem. anterior: ${k.matriculas_semana_anterior}`}
            delta={<Delta current={k.matriculas_semana} previous={k.matriculas_semana_anterior} />} />
          <KPIBlock icon={UserMinus} label="Cancelamentos (Sem.)" value={k.cancelamentos_semana}
            sub={`Sem. anterior: ${k.cancelamentos_semana_anterior}`}
            delta={<Delta current={k.cancelamentos_semana} previous={k.cancelamentos_semana_anterior} invertColors />} />
          <KPIBlock icon={CheckCircle2} label="Compareci­mento" value={`${k.taxa_comparecimento}%`}
            sub={`${k.comparecimentos_semana}/${k.experimentais_semana} exp.`}
            delta={<Delta current={k.taxa_comparecimento} previous={k.taxa_comparecimento_anterior} asPercent />} />
          <KPIBlock icon={Target} label="Conversão Exp→Mat" value={`${k.taxa_conversao}%`}
            sub={`Anterior: ${k.taxa_conversao_anterior}%`}
            delta={<Delta current={k.taxa_conversao} previous={k.taxa_conversao_anterior} asPercent />} />
          <KPIBlock icon={Clock} label="Follow-ups Pend." value={k.follow_ups_pendentes}
            sub={`${k.follow_ups_atrasados_24h} atrasados 24h`} />
          <KPIBlock icon={DollarSign} label="Receita do Mês" value={fmtBRL(k.receita_mes)}
            sub={`Mês anterior: ${fmtBRL(k.receita_mes_anterior)}`}
            delta={<Delta current={k.receita_mes} previous={k.receita_mes_anterior} />} />
          <KPIBlock icon={PieChart} label="Ocupação" value={`${k.ocupacao_pct}%`}
            sub={`Meta: ${k.meta?.meta_ocupacao_pct ?? 80}%`} />

          {/* Ticket médio real (manual) */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground text-xs uppercase tracking-wider">
              <DollarSign className="w-3.5 h-3.5" />
              Ticket Médio Real
            </div>
            {editingTicket ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={ticketValue}
                  onChange={e => setTicketValue(+e.target.value)}
                  className="h-8"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveTicket} disabled={savingTicket}>
                  {savingTicket ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingTicket(false); setTicketValue(k.ticket_medio_real); }}>X</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-foreground">{fmtBRL(k.ticket_medio_real)}</div>
                <Button size="sm" variant="ghost" onClick={() => setEditingTicket(true)}>Editar</Button>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">informado manualmente</div>
          </div>

          <KPIBlock icon={TrendingUp} label="Receita Recorrente Projetada"
            value={fmtBRL(k.receita_recorrente_projetada)}
            sub={`${k.alunos_ativos} ativos × ${fmtBRL(k.ticket_medio_real)}`} />

          <KPIBlock icon={UserMinus} label="Evasão do Mês" value={`${k.evasao_pct_mes}%`}
            sub="informado manualmente" />

          <KPIBlock icon={DollarSign} label="CAC"
            value={k.cac !== null ? fmtBRL(k.cac) : '—'}
            sub="informado manualmente" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Ocupação atual</span>
            <span>{k.ocupacao_pct}% de {k.meta?.meta_ocupacao_pct ?? 80}% meta</span>
          </div>
          <Progress value={Math.min(100, (k.ocupacao_pct / (k.meta?.meta_ocupacao_pct || 80)) * 100)} />
        </div>
      </CardContent>
    </Card>
  );
}

function DetalheUnidade({ k }: { k: UnidadeKPIs }) {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchUnidadeHistorico(k.unidade_id, k.meta?.capacidade_alunos ?? 0, 8)
      .then(setSeries)
      .finally(() => setLoading(false));
  }, [k.unidade_id, k.meta?.capacidade_alunos]);

  const metaOcup = k.meta?.meta_ocupacao_pct ?? 80;
  const metaMat = k.meta?.meta_matriculas_semana ?? 0;
  const metaReceita = k.meta?.meta_receita_mes ?? 0;
  const metaComp = k.meta?.meta_taxa_comparecimento_pct ?? 75;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{k.unidade_nome} — Histórico (8 semanas)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="semana" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Line type="monotone" dataKey="matriculas" stroke="hsl(var(--primary))" name="Matrículas" strokeWidth={2} />
                <Line type="monotone" dataKey="cancelamentos" stroke="hsl(0 84% 60%)" name="Cancelamentos" strokeWidth={2} />
                <Line type="monotone" dataKey="ocupacao" stroke="hsl(160 60% 45%)" name="Ocupação %" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Meta vs Realizado</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <MetaBar label="Ocupação" current={k.ocupacao_pct} meta={metaOcup} suffix="%" />
          <MetaBar label="Matrículas da semana" current={k.matriculas_semana} meta={metaMat} />
          <MetaBar label="Receita do mês" current={k.receita_mes} meta={metaReceita} isCurrency />
          <MetaBar label="Taxa de comparecimento" current={k.taxa_comparecimento} meta={metaComp} suffix="%" />
        </CardContent>
      </Card>
    </div>
  );
}

function MetaBar({ label, current, meta, suffix = '', isCurrency = false, showMissing = false }: { label: string; current: number; meta: number; suffix?: string; isCurrency?: boolean; showMissing?: boolean }) {
  const pct = meta > 0 ? Math.min(100, Math.round((current / meta) * 100)) : 0;
  const display = (n: number) => isCurrency ? fmtBRL(n) : `${n}${suffix}`;
  const missing = meta - current;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {display(current)} / {meta > 0 ? display(meta) : '—'}
          {showMissing && meta > 0 ? (
            <span className={missing > 0 ? 'text-orange-500 ml-1' : 'text-green-600 ml-1'}>
              ({missing > 0 ? `faltam ${missing}` : `+${Math.abs(missing)} acima`})
            </span>
          ) : (
            <span className="ml-1">({pct}%)</span>
          )}
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

function LancamentoSemanal({ unidades, onSaved }: { unidades: UnidadeKPIs[]; onSaved: () => void }) {
  const thisMonday = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.unidade_id ?? '');
  const [semana, setSemana] = useState(thisMonday);
  const [totalAtivos, setTotalAtivos] = useState(0);
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  const unidade = useMemo(() => unidades.find(u => u.unidade_id === unidadeId), [unidades, unidadeId]);

  // Auto-populate manual ativos from current KPIs and reset observações when unidade changes
  useEffect(() => {
    if (unidade) setTotalAtivos(unidade.alunos_ativos);
  }, [unidade?.unidade_id, unidade?.alunos_ativos]);

  useEffect(() => {
    if (!unidadeId && unidades[0]) setUnidadeId(unidades[0].unidade_id);
  }, [unidades]);

  const autoFields = unidade ? {
    experimentais_agendados: unidade.experimentais_semana,
    comparecimentos: unidade.comparecimentos_semana,
    matriculas_fechadas: unidade.matriculas_semana,
    cancelamentos: unidade.cancelamentos_semana,
    follow_ups_pendentes: unidade.follow_ups_pendentes,
    receita_semana: unidade.receita_mes, // receita do mês como proxy
  } : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidade || !autoFields) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Persist total_alunos_ativos in gestao_metas (registro permanente)
    if (unidade.meta?.id) {
      await supabase.from('gestao_metas')
        .update({ alunos_ativos_manual: totalAtivos })
        .eq('id', unidade.meta.id);
    }

    // 2. Upsert do lançamento semanal (snapshot histórico)
    const { error } = await supabase.from('gestao_lancamentos_semanais').upsert({
      unidade_id: unidadeId,
      semana_referencia: semana,
      total_alunos_ativos: totalAtivos,
      ...autoFields,
      observacoes: observacoes ? observacoes.toUpperCase() : null,
      created_by: user?.id,
    }, { onConflict: 'unidade_id,semana_referencia' });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Lançamento salvo com sucesso');
    onSaved();
  };

  const ReadOnlyField = ({ label, value }: { label: string; value: string | number }) => (
    <div>
      <Label className="text-muted-foreground">{label}</Label>
      <Input value={value} readOnly disabled className="bg-muted/40" />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lançamento Semanal</CardTitle>
        <CardDescription>
          Os números são preenchidos automaticamente a partir do CRM. Apenas o total de alunos ativos é inserido manualmente. Ao salvar, fica registrado um snapshot da semana.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Unidade</Label>
            <Select value={unidadeId} onValueChange={setUnidadeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {unidades.map(u => <SelectItem key={u.unidade_id} value={u.unidade_id}>{u.unidade_nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Semana de Referência (segunda)</Label>
            <Input type="date" value={semana} onChange={e => setSemana(e.target.value)} required />
          </div>

          <div className="md:col-span-2 border-t pt-4">
            <Label className="text-base font-semibold">Entrada manual</Label>
          </div>
          <div className="md:col-span-2">
            <Label>Total de alunos ativos</Label>
            <Input type="number" value={totalAtivos} onChange={e => setTotalAtivos(+e.target.value)} required />
            <p className="text-xs text-muted-foreground mt-1">
              Este valor também atualiza o card "Alunos Ativos" da unidade.
            </p>
          </div>

          {autoFields && (
            <>
              <div className="md:col-span-2 border-t pt-4">
                <Label className="text-base font-semibold">Calculado automaticamente do CRM</Label>
              </div>
              <ReadOnlyField label="Experimentais agendados (semana)" value={autoFields.experimentais_agendados} />
              <ReadOnlyField label="Comparecimentos (semana)" value={autoFields.comparecimentos} />
              <ReadOnlyField label="Matrículas fechadas (semana)" value={autoFields.matriculas_fechadas} />
              <ReadOnlyField label="Cancelamentos (semana)" value={autoFields.cancelamentos} />
              <ReadOnlyField label="Follow-ups pendentes" value={autoFields.follow_ups_pendentes} />
              <ReadOnlyField label="Receita do mês (R$)" value={fmtBRL(autoFields.receita_semana)} />
            </>
          )}

          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Input value={observacoes} onChange={e => setObservacoes(e.target.value.toUpperCase())} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving || !unidade} className="w-full md:w-auto">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar Lançamento
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MetaConsolidada({ kpis }: { kpis: UnidadeKPIs[] }) {
  const totalAlunos = kpis.reduce((s, k) => s + k.alunos_ativos, 0);
  const totalMeta = kpis.reduce((s, k) => s + (k.meta_alunos_mes ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Meta vs Realizado — Consolidado
        </CardTitle>
        <CardDescription>
          Total de alunos vs meta do mês (somatório de todas as unidades).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MetaBar label="Alunos no mês (total)" current={totalAlunos} meta={totalMeta} showMissing />
        {kpis.map(k => (
          <MetaBar
            key={k.unidade_id}
            label={k.unidade_nome}
            current={k.alunos_ativos}
            meta={k.meta_alunos_mes}
            showMissing
          />
        ))}
      </CardContent>
    </Card>
  );
}


function Alertas({ kpis }: { kpis: UnidadeKPIs[] }) {
  const total = kpis.reduce((s, k) => s + k.alertas.length, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Alertas Automáticos ({total})
        </CardTitle>
        <CardDescription>Gerados a partir dos dados em tempo real do CRM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {kpis.map(k => (
          <div key={k.unidade_id}>
            <h3 className="font-semibold mb-2">{k.unidade_nome}</h3>
            {k.alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" /> Nenhum alerta ativo.
              </p>
            ) : (
              <ul className="space-y-2">
                {k.alertas.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                    <span className="text-sm">{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function GestaoOperacional() {
  const { loading, kpis, refetch } = useGestaoOperacional();
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');

  useEffect(() => {
    if (kpis[0] && !selectedUnidade) setSelectedUnidade(kpis[0].unidade_id);
  }, [kpis]);

  const detalhe = useMemo(() => kpis.find(k => k.unidade_id === selectedUnidade), [kpis, selectedUnidade]);

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestão Operacional</h1>
            <p className="text-muted-foreground">Visão consolidada das unidades Iron Club</p>
          </div>
          <Button variant="outline" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="visao-geral">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
              <TabsTrigger value="unidade">Unidade</TabsTrigger>
              <TabsTrigger value="lancamento">Lançamento</TabsTrigger>
              <TabsTrigger value="alertas">
                Alertas {kpis.reduce((s, k) => s + k.alertas.length, 0) > 0 &&
                  <Badge variant="destructive" className="ml-2">{kpis.reduce((s, k) => s + k.alertas.length, 0)}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visao-geral" className="space-y-4 mt-4">
              <MetaConsolidada kpis={kpis} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {kpis.map(k => <UnidadeCard key={k.unidade_id} k={k} onRefetch={refetch} />)}
              </div>
            </TabsContent>

            <TabsContent value="unidade" className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <Label>Selecionar unidade:</Label>
                <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {kpis.map(k => <SelectItem key={k.unidade_id} value={k.unidade_id}>{k.unidade_nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {detalhe && <DetalheUnidade k={detalhe} />}
            </TabsContent>

            <TabsContent value="lancamento" className="mt-4">
              <LancamentoSemanal unidades={kpis} onSaved={refetch} />
            </TabsContent>

            <TabsContent value="alertas" className="mt-4">
              <Alertas kpis={kpis} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
