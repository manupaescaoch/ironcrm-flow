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
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, Users, UserPlus, UserMinus, CheckCircle2, Target, Clock, DollarSign, PieChart, RefreshCw, Pencil, Send, GraduationCap, XCircle, Activity, Wallet, ShieldAlert } from 'lucide-react';
import { useGestaoOperacional, UnidadeKPIs, SeriesPoint, fetchUnidadeHistorico } from '@/hooks/useGestaoOperacional';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, startOfWeek, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
    <span className={`text-xs inline-flex items-center gap-1 font-medium ${isGood ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {asPercent ? `${diff > 0 ? '+' : ''}${diff}pp` : `${diff > 0 ? '+' : ''}${pct}%`}
    </span>
  );
}

/** KPI compacto no topo (estilo dashboard) */
function SummaryKPI({ icon: Icon, label, value, sub, delta, iconBg = 'bg-primary/10', iconColor = 'text-primary' }: any) {
  return (
    <Card className="shadow-sm rounded-2xl">
      <CardContent className="p-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          </div>
          <p className="text-[11px] font-medium text-muted-foreground leading-tight min-w-0 flex-1">{label}</p>
        </div>
        <p className="text-xl font-bold leading-none mb-0.5 truncate text-foreground">{value}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground leading-tight line-clamp-1">{sub}</span>
          {delta}
        </div>
      </CardContent>
    </Card>
  );
}

/** Mini métrica dentro de uma sub-seção da unidade */
function MiniMetric({ label, value, sub, delta, action }: { label: string; value: React.ReactNode; sub?: string; delta?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{label}</div>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <div className="text-base font-bold text-foreground truncate leading-tight">{value}</div>
        {action}
      </div>
      <div className="flex items-center justify-between mt-0.5 gap-2">
        <span className="text-[10px] text-muted-foreground truncate">{sub}</span>
        {delta}
      </div>
    </div>
  );
}

/** Sub-seção (Ocupação / Comercial / Financeiro / Retenção) */
function SubSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="w-3 h-3 text-primary" />
        </div>
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {children}
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
          <Pencil className="w-3 h-3" /> Editar meta
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

/** Linha de 4 KPIs consolidados no topo */
function TopKPIsRow({ kpis }: { kpis: UnidadeKPIs[] }) {
  const totAtivos = kpis.reduce((s, k) => s + k.alunos_ativos, 0);
  const totMeta = kpis.reduce((s, k) => s + (k.meta_alunos_mes ?? 0), 0);
  const pctMeta = totMeta > 0 ? Math.round((totAtivos / totMeta) * 100) : 0;

  const totMatr = kpis.reduce((s, k) => s + k.matriculas_semana, 0);
  const totMatrAnt = kpis.reduce((s, k) => s + k.matriculas_semana_anterior, 0);

  const totCanc = kpis.reduce((s, k) => s + k.cancelamentos_semana, 0);
  const totCancAnt = kpis.reduce((s, k) => s + k.cancelamentos_semana_anterior, 0);

  const totFu = kpis.reduce((s, k) => s + k.follow_ups_pendentes, 0);
  const totFuAtr = kpis.reduce((s, k) => s + k.follow_ups_atrasados_24h, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      <SummaryKPI
        icon={Users}
        label="Alunos ativos total"
        value={totAtivos}
        sub={totMeta > 0 ? `${pctMeta}% da meta (${totMeta})` : 'Meta não definida'}
      />
      <SummaryKPI
        icon={GraduationCap}
        label="Matrículas da semana"
        value={totMatr}
        sub={`Semana anterior: ${totMatrAnt}`}
        delta={<Delta current={totMatr} previous={totMatrAnt} />}
        iconBg="bg-emerald-500/10"
        iconColor="text-emerald-600"
      />
      <SummaryKPI
        icon={Send}
        label="Follow-ups atrasados"
        value={totFuAtr}
        sub={`Pendentes no total: ${totFu}`}
        iconBg="bg-blue-500/10"
        iconColor="text-blue-600"
      />
    </div>
  );
}


function UnidadeCard({ k, onRefetch }: { k: UnidadeKPIs; onRefetch: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(k.alunos_ativos);
  const [saving, setSaving] = useState(false);

  const [editingTicket, setEditingTicket] = useState(false);
  const [ticketValue, setTicketValue] = useState(k.ticket_medio_real);
  const [savingTicket, setSavingTicket] = useState(false);

  const [editingEvasao, setEditingEvasao] = useState(false);
  const [evasaoValue, setEvasaoValue] = useState(k.evasao_pct_mes);
  const [savingEvasao, setSavingEvasao] = useState(false);

  const [editingCac, setEditingCac] = useState(false);
  const [cacValue, setCacValue] = useState(k.cac ?? 0);
  const [savingCac, setSavingCac] = useState(false);

  useEffect(() => { setValue(k.alunos_ativos); }, [k.alunos_ativos]);
  useEffect(() => { setTicketValue(k.ticket_medio_real); }, [k.ticket_medio_real]);
  useEffect(() => { setEvasaoValue(k.evasao_pct_mes); }, [k.evasao_pct_mes]);
  useEffect(() => { setCacValue(k.cac ?? 0); }, [k.cac]);

  const handleSave = async () => {
    if (!k.meta?.id) { toast.error('Meta da unidade não encontrada.'); return; }
    setSaving(true);
    const { error } = await supabase.from('gestao_metas').update({ alunos_ativos_manual: value }).eq('id', k.meta.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Alunos ativos atualizado');
    setEditing(false);
    onRefetch();
  };

  const handleSaveTicket = async () => {
    if (!k.meta?.id) { toast.error('Meta da unidade não encontrada.'); return; }
    setSavingTicket(true);
    const { error } = await supabase.from('gestao_metas').update({ ticket_medio_real: ticketValue }).eq('id', k.meta.id);
    setSavingTicket(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Ticket médio atualizado');
    setEditingTicket(false);
    onRefetch();
  };

  const handleSaveEvasao = async () => {
    if (!k.meta?.id) { toast.error('Meta da unidade não encontrada.'); return; }
    setSavingEvasao(true);
    const { error } = await supabase.from('gestao_metas').update({ evasao_pct_manual: evasaoValue }).eq('id', k.meta.id);
    setSavingEvasao(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Evasão atualizada');
    setEditingEvasao(false);
    onRefetch();
  };

  const handleSaveCac = async () => {
    if (!k.meta?.id) { toast.error('Meta da unidade não encontrada.'); return; }
    setSavingCac(true);
    const { error } = await supabase.from('gestao_metas').update({ cac_manual: cacValue }).eq('id', k.meta.id);
    setSavingCac(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('CAC atualizado');
    setEditingCac(false);
    onRefetch();
  };


  const metaOcup = k.meta?.meta_ocupacao_pct ?? 80;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 p-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="text-base">{k.unidade_nome}</span>
          <div className="flex items-center gap-2">
            {k.alertas.length > 0 && (
              <Badge variant="destructive" className="gap-1 h-5 text-[10px] px-1.5">
                <AlertTriangle className="w-3 h-3" />
                {k.alertas.length}
              </Badge>
            )}
            <EditarMetasDialog k={k} onSaved={onRefetch} />
          </div>
        </CardTitle>
        <CardDescription className="text-xs">
          Capacidade {k.meta?.capacidade_alunos ?? '—'} alunos · Meta de ocupação {metaOcup}%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">

        {/* Ocupação */}
        <SubSection icon={PieChart} title="Ocupação">
          <MiniMetric
            label="Alunos ativos"
            value={k.alunos_ativos}
            sub="Editar no Dashboard"
          />

          <MiniMetric
            label="Ocupação"
            value={`${k.ocupacao_pct}%`}
            sub={`Meta: ${metaOcup}%`}
            delta={<Delta current={k.ocupacao_pct} previous={metaOcup} asPercent />}
          />
          <MiniMetric
            label="Receita recorrente projetada"
            value={fmtBRL(k.receita_recorrente_projetada)}
            sub={`${k.alunos_ativos} ativos × ${fmtBRL(k.ticket_medio_real)}`}
          />
        </SubSection>

        {/* Comercial da semana */}
        <SubSection icon={GraduationCap} title="Comercial da semana">
          <MiniMetric
            label="Matrículas"
            value={k.matriculas_semana}
            sub={`Semana anterior: ${k.matriculas_semana_anterior}`}
            delta={<Delta current={k.matriculas_semana} previous={k.matriculas_semana_anterior} />}
          />
          <MiniMetric
            label="Comparecimento"
            value={`${k.taxa_comparecimento}%`}
            sub={`Semana anterior: ${k.taxa_comparecimento_anterior}%`}
            delta={<Delta current={k.taxa_comparecimento} previous={k.taxa_comparecimento_anterior} asPercent />}
          />
          <MiniMetric
            label="Conversão EXP→MAT"
            value={`${k.taxa_conversao}%`}
            sub={`Semana anterior: ${k.taxa_conversao_anterior}%`}
            delta={<Delta current={k.taxa_conversao} previous={k.taxa_conversao_anterior} asPercent />}
          />
        </SubSection>

        {/* Financeiro */}
        <SubSection icon={Wallet} title="Financeiro">
          <MiniMetric
            label="Receita do mês"
            value={fmtBRL(k.receita_mes)}
            sub={`Mês anterior: ${fmtBRL(k.receita_mes_anterior)}`}
            delta={<Delta current={k.receita_mes} previous={k.receita_mes_anterior} />}
          />
          <MiniMetric
            label="Ticket médio real"
            value={editingTicket ? (
              <div className="flex items-center gap-1 w-full">
                <Input type="number" step="0.01" value={ticketValue} onChange={e => setTicketValue(+e.target.value)} className="h-7 text-base font-bold" autoFocus />
                <Button size="sm" className="h-7 px-2" onClick={handleSaveTicket} disabled={savingTicket}>
                  {savingTicket ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                </Button>
              </div>
            ) : fmtBRL(k.ticket_medio_real)}
            sub="Mês anterior: —"
            action={!editingTicket && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditingTicket(true)}>Editar</Button>}
          />
          <MiniMetric
            label="Investimento tráfego"
            value={fmtBRL(k.investimento_mes)}
            sub={k.matriculas_mes > 0 ? `${k.matriculas_mes} matrículas no mês` : 'sem matrículas no mês'}
          />
          <MiniMetric
            label="CAC"
            value={editingCac ? (
              <div className="flex items-center gap-1 w-full">
                <Input type="number" step="0.01" value={cacValue} onChange={e => setCacValue(+e.target.value)} className="h-7 text-base font-bold" autoFocus />
                <Button size="sm" className="h-7 px-2" onClick={handleSaveCac} disabled={savingCac}>
                  {savingCac ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                </Button>
              </div>
            ) : (k.cac !== null ? fmtBRL(k.cac) : '—')}
            sub={
              k.cac_calculado !== null
                ? `auto: ${fmtBRL(k.investimento_mes)} ÷ ${k.matriculas_mes}`
                : (k.cac_manual !== null ? 'informado manualmente' : 'sem dados')
            }
            action={!editingCac && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditingCac(true)}>Editar</Button>}
          />


        </SubSection>

        {/* Retenção e pendências */}
        <SubSection icon={ShieldAlert} title="Retenção e pendências">
          <MiniMetric
            label="Follow-ups atrasados"
            value={k.follow_ups_atrasados_24h}
            sub={`Pendentes no total: ${k.follow_ups_pendentes}`}
          />
          <MiniMetric
            label="Evasão do mês"
            value={editingEvasao ? (
              <div className="flex items-center gap-1 w-full">
                <Input type="number" step="0.01" value={evasaoValue} onChange={e => setEvasaoValue(+e.target.value)} className="h-7 text-base font-bold" autoFocus />
                <Button size="sm" className="h-7 px-2" onClick={handleSaveEvasao} disabled={savingEvasao}>
                  {savingEvasao ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                </Button>
              </div>
            ) : `${k.evasao_pct_mes}%`}
            sub="informado manualmente"
            action={!editingEvasao && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditingEvasao(true)}>Editar</Button>}
          />
        </SubSection>


        {/* Barra de ocupação atual */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium flex-1">Ocupação atual</span>
            <span className="text-sm text-muted-foreground">{k.ocupacao_pct}% de {metaOcup}% da meta</span>
          </div>
          <Progress value={Math.min(100, (k.ocupacao_pct / metaOcup) * 100)} />
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
    receita_semana: unidade.receita_mes,
  } : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidade || !autoFields) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (unidade.meta?.id) {
      await supabase.from('gestao_metas').update({ alunos_ativos_manual: totalAtivos }).eq('id', unidade.meta.id);
    }

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
          Os números são preenchidos automaticamente a partir do CRM. O total de alunos ativos é puxado do Dashboard. Ao salvar, fica registrado um snapshot da semana.
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

          <div className="md:col-span-2">
            <Label>Total de alunos ativos</Label>
            <Input type="number" value={totalAtivos} readOnly disabled className="bg-muted/40" />
            <p className="text-xs text-muted-foreground mt-1">
              Puxado automaticamente do Dashboard. Para alterar, edite o KPI "Alunos Ativos" no Dashboard da unidade.
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

/** Bloco "Meta vs Realizado — Consolidado" com % grande à esquerda e barras à direita */
function MetaConsolidada({ kpis }: { kpis: UnidadeKPIs[] }) {
  const totalAlunos = kpis.reduce((s, k) => s + k.alunos_ativos, 0);
  const totalMeta = kpis.reduce((s, k) => s + (k.meta_alunos_mes ?? 0), 0);
  const pct = totalMeta > 0 ? Math.round((totalAlunos / totalMeta) * 100) : 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Meta vs Realizado — Consolidado</CardTitle>
        <CardDescription>Total de alunos vs meta do mês (somatório de todas as unidades).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">
          <div>
            <div className="text-6xl font-bold text-primary leading-none">{pct}%</div>
            <div className="text-sm text-muted-foreground mt-2">{totalAlunos} / {totalMeta} alunos</div>
          </div>
          <div className="space-y-3">
            <Progress value={Math.min(100, pct)} className="h-3" />
            {kpis.map(k => {
              const p = k.meta_alunos_mes > 0 ? Math.round((k.alunos_ativos / k.meta_alunos_mes) * 100) : 0;
              return (
                <div key={k.unidade_id} className="grid grid-cols-[140px_1fr_120px] items-center gap-3">
                  <span className="text-sm font-medium truncate">{k.unidade_nome}</span>
                  <Progress value={Math.min(100, p)} className="h-2" />
                  <span className="text-sm text-muted-foreground text-right">
                    {k.alunos_ativos} / {k.meta_alunos_mes || '—'} <span className="font-semibold text-foreground ml-1">{p}%</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
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
  const [refDate, setRefDate] = useState<Date>(startOfMonth(new Date()));
  const { loading, kpis, refetch } = useGestaoOperacional(refDate);
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (kpis[0] && !selectedUnidade) setSelectedUnidade(kpis[0].unidade_id);
  }, [kpis]);

  useEffect(() => {
    if (!loading) setLastUpdate(new Date());
  }, [loading]);

  const detalhe = useMemo(() => kpis.find(k => k.unidade_id === selectedUnidade), [kpis, selectedUnidade]);

  // Últimos 12 meses + próximos 2 para permitir planejamento
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string; date: Date }[] = [];
    const base = startOfMonth(new Date());
    for (let i = -2; i <= 12; i++) {
      const d = subMonths(base, i);
      opts.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
        date: d,
      });
    }
    return opts;
  }, []);
  const currentMonthValue = format(refDate, 'yyyy-MM');

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Gestão Operacional</h1>
            <p className="text-muted-foreground">Visão consolidada das unidades EVO TRAINING CLUB</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Mês:</Label>
              <Select
                value={currentMonthValue}
                onValueChange={(v) => {
                  const opt = monthOptions.find(o => o.value === v);
                  if (opt) setRefDate(opt.date);
                }}
              >
                <SelectTrigger className="w-[200px] h-9 capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(o => (
                    <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Última atualização: hoje, {format(lastUpdate, 'HH:mm')}
            </span>
            <Button variant="outline" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

          </div>
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
              <TopKPIsRow kpis={kpis} />
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
