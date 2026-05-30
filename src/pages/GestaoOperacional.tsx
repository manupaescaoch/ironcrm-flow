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
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, Users, UserPlus, UserMinus, CheckCircle2, Target, Clock, DollarSign, PieChart, RefreshCw } from 'lucide-react';
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

function UnidadeCard({ k }: { k: UnidadeKPIs }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{k.unidade_nome}</span>
          {k.alertas.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              {k.alertas.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Capacidade {k.meta?.capacidade_alunos ?? '—'} alunos · Meta de ocupação {k.meta?.meta_ocupacao_pct ?? 80}%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <KPIBlock icon={Users} label="Alunos Ativos" value={k.alunos_ativos} sub="matriculados ativos" />
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

function MetaBar({ label, current, meta, suffix = '', isCurrency = false }: { label: string; current: number; meta: number; suffix?: string; isCurrency?: boolean }) {
  const pct = meta > 0 ? Math.min(100, Math.round((current / meta) * 100)) : 0;
  const display = (n: number) => isCurrency ? fmtBRL(n) : `${n}${suffix}`;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{display(current)} / {meta > 0 ? display(meta) : '—'} ({pct}%)</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

function LancamentoSemanal({ unidades, onSaved }: { unidades: UnidadeKPIs[]; onSaved: () => void }) {
  const thisMonday = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const [form, setForm] = useState({
    unidade_id: unidades[0]?.unidade_id ?? '',
    semana_referencia: thisMonday,
    total_alunos_ativos: 0,
    experimentais_agendados: 0,
    comparecimentos: 0,
    matriculas_fechadas: 0,
    cancelamentos: 0,
    follow_ups_pendentes: 0,
    receita_semana: 0,
    observacoes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.unidade_id && unidades[0]) setForm(f => ({ ...f, unidade_id: unidades[0].unidade_id }));
  }, [unidades]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('gestao_lancamentos_semanais').upsert({
      ...form,
      observacoes: form.observacoes ? form.observacoes.toUpperCase() : null,
      created_by: user?.id,
    }, { onConflict: 'unidade_id,semana_referencia' });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Lançamento salvo com sucesso');
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lançamento Semanal</CardTitle>
        <CardDescription>Use toda segunda-feira para registrar os números da semana anterior.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Unidade</Label>
            <Select value={form.unidade_id} onValueChange={v => setForm({ ...form, unidade_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {unidades.map(u => <SelectItem key={u.unidade_id} value={u.unidade_id}>{u.unidade_nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Semana de Referência (segunda)</Label>
            <Input type="date" value={form.semana_referencia} onChange={e => setForm({ ...form, semana_referencia: e.target.value })} required />
          </div>
          <div><Label>Total de alunos ativos</Label><Input type="number" value={form.total_alunos_ativos} onChange={e => setForm({ ...form, total_alunos_ativos: +e.target.value })} /></div>
          <div><Label>Experimentais agendados</Label><Input type="number" value={form.experimentais_agendados} onChange={e => setForm({ ...form, experimentais_agendados: +e.target.value })} /></div>
          <div><Label>Comparecimentos</Label><Input type="number" value={form.comparecimentos} onChange={e => setForm({ ...form, comparecimentos: +e.target.value })} /></div>
          <div><Label>Matrículas fechadas</Label><Input type="number" value={form.matriculas_fechadas} onChange={e => setForm({ ...form, matriculas_fechadas: +e.target.value })} /></div>
          <div><Label>Cancelamentos</Label><Input type="number" value={form.cancelamentos} onChange={e => setForm({ ...form, cancelamentos: +e.target.value })} /></div>
          <div><Label>Follow-ups pendentes</Label><Input type="number" value={form.follow_ups_pendentes} onChange={e => setForm({ ...form, follow_ups_pendentes: +e.target.value })} /></div>
          <div><Label>Receita da semana (R$)</Label><Input type="number" step="0.01" value={form.receita_semana} onChange={e => setForm({ ...form, receita_semana: +e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value.toUpperCase() })} /></div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving} className="w-full md:w-auto">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar Lançamento
            </Button>
          </div>
        </form>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {kpis.map(k => <UnidadeCard key={k.unidade_id} k={k} />)}
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
