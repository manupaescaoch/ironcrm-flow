import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, TrendingUp, Users, Star, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { Link } from 'react-router-dom';

type Resposta = {
  id: string;
  unidade_id: string | null;
  unidade_nome: string;
  nota_nps: number;
  estrelas_estrutura: number;
  estrelas_equipe: number;
  estrelas_treino: number;
  categoria: 'detrator' | 'passivo' | 'promotor';
  created_at: string;
};

type Unidade = { id: string; nome: string };

const COLORS = {
  promotor: 'hsl(var(--success))',
  passivo: 'hsl(var(--warning))',
  detrator: 'hsl(var(--destructive))',
  primary: 'hsl(var(--primary))',
};

export default function NpsDashboard() {
  const { unidadeAtual } = useUnidade();
  const [unidade, setUnidade] = useState<string>(unidadeAtual?.id ?? '');

  // A visualização é sempre restrita à unidade ativa selecionada no menu
  useEffect(() => {
    if (unidadeAtual?.id) setUnidade(unidadeAtual.id);
  }, [unidadeAtual?.id]);
  const [periodo, setPeriodo] = useState<'7' | '30' | '90' | '180' | 'custom'>('30');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

  const { from, to } = useMemo(() => {
    if (periodo === 'custom') return { from: customRange.from, to: customRange.to };
    const days = parseInt(periodo);
    const f = new Date();
    f.setDate(f.getDate() - days);
    f.setHours(0, 0, 0, 0);
    return { from: f, to: new Date() };
  }, [periodo, customRange]);

  const { data: unidades = [] } = useQuery({
    queryKey: ['nps-dash-unidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return (data ?? []) as Unidade[];
    },
  });

  const { data: respostas = [], isLoading } = useQuery({
    queryKey: ['nps-dash-respostas', unidade, from?.toISOString(), to?.toISOString()],
    enabled: !!unidade,
    queryFn: async () => {
      let q = supabase
        .from('nps_respostas')
        .select(
          'id, unidade_id, unidade_nome, nota_nps, estrelas_estrutura, estrelas_equipe, estrelas_treino, categoria, created_at',
        )
        .order('created_at', { ascending: true });
      q = q.eq('unidade_id', unidade);
      if (from) q = q.gte('created_at', from.toISOString());
      if (to) q = q.lte('created_at', to.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Resposta[];
    },
  });

  const kpis = useMemo(() => {
    const n = respostas.length;
    if (!n) {
      return {
        total: 0,
        nps: 0,
        media: 0,
        promotores: 0,
        passivos: 0,
        detratores: 0,
        promPct: 0,
        pasPct: 0,
        detPct: 0,
        estrutura: 0,
        equipe: 0,
        treino: 0,
      };
    }
    const prom = respostas.filter((r) => r.categoria === 'promotor').length;
    const pas = respostas.filter((r) => r.categoria === 'passivo').length;
    const det = respostas.filter((r) => r.categoria === 'detrator').length;
    const sum = (k: keyof Resposta) =>
      respostas.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
    return {
      total: n,
      nps: Math.round((prom / n) * 100 - (det / n) * 100),
      media: +(sum('nota_nps') / n).toFixed(1),
      promotores: prom,
      passivos: pas,
      detratores: det,
      promPct: Math.round((prom / n) * 100),
      pasPct: Math.round((pas / n) * 100),
      detPct: Math.round((det / n) * 100),
      estrutura: +(sum('estrelas_estrutura') / n).toFixed(1),
      equipe: +(sum('estrelas_equipe') / n).toFixed(1),
      treino: +(sum('estrelas_treino') / n).toFixed(1),
    };
  }, [respostas]);

  // Distribuição de notas 0..10
  const distribuicaoNotas = useMemo(() => {
    const buckets = Array.from({ length: 11 }, (_, i) => ({ nota: i, qtd: 0 }));
    respostas.forEach((r) => {
      if (r.nota_nps >= 0 && r.nota_nps <= 10) buckets[r.nota_nps].qtd += 1;
    });
    return buckets;
  }, [respostas]);

  // Evolução por período (agrupa por dia/semana/mês conforme intervalo)
  const evolucao = useMemo(() => {
    if (!from || !to || respostas.length === 0) return [];
    const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const granularity: 'day' | 'week' | 'month' =
      diffDays <= 31 ? 'day' : diffDays <= 120 ? 'week' : 'month';
    const buckets =
      granularity === 'day'
        ? eachDayOfInterval({ start: from, end: to }).map((d) => startOfDay(d))
        : granularity === 'week'
        ? eachWeekOfInterval({ start: from, end: to }, { locale: ptBR }).map((d) =>
            startOfWeek(d, { locale: ptBR }),
          )
        : eachMonthOfInterval({ start: from, end: to }).map((d) => startOfMonth(d));
    const fmt = granularity === 'day' ? 'dd/MM' : granularity === 'week' ? "'sem' dd/MM" : 'MMM/yy';
    const map = new Map<number, { promotor: number; passivo: number; detrator: number; total: number; notaSum: number }>();
    buckets.forEach((b) =>
      map.set(b.getTime(), { promotor: 0, passivo: 0, detrator: 0, total: 0, notaSum: 0 }),
    );
    respostas.forEach((r) => {
      const d = new Date(r.created_at);
      const key =
        granularity === 'day'
          ? startOfDay(d).getTime()
          : granularity === 'week'
          ? startOfWeek(d, { locale: ptBR }).getTime()
          : startOfMonth(d).getTime();
      const slot = map.get(key);
      if (!slot) return;
      slot[r.categoria] += 1;
      slot.total += 1;
      slot.notaSum += r.nota_nps;
    });
    return Array.from(map.entries()).map(([ts, s]) => ({
      label: format(new Date(ts), fmt, { locale: ptBR }),
      promotor: s.promotor,
      passivo: s.passivo,
      detrator: s.detrator,
      total: s.total,
      nps: s.total ? Math.round((s.promotor / s.total) * 100 - (s.detrator / s.total) * 100) : 0,
      media: s.total ? +(s.notaSum / s.total).toFixed(1) : 0,
    }));
  }, [respostas, from, to]);

  const distribuicaoCategoria = [
    { name: 'Promotores', value: kpis.promotores, color: COLORS.promotor },
    { name: 'Passivos', value: kpis.passivos, color: COLORS.passivo },
    { name: 'Detratores', value: kpis.detratores, color: COLORS.detrator },
  ];

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard NPS</h1>
            <p className="text-muted-foreground text-sm">
              Métricas e evolução das avaliações dos alunos
            </p>
          </div>
          <Link to="/nps/respostas">
            <Button variant="outline" size="sm">Ver respostas detalhadas</Button>
          </Link>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3">
            <div className="min-w-[200px]">
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="180">Últimos 180 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodo === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {customRange.from ? format(customRange.from, 'dd/MM/yy') : 'Início'}
                    {' — '}
                    {customRange.to ? format(customRange.to, 'dd/MM/yy') : 'Fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={customRange as any}
                    onSelect={(r: any) => setCustomRange(r ?? {})}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* KPIs principais */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                label="Score NPS"
                value={kpis.nps}
                icon={<TrendingUp className="w-4 h-4" />}
                tone={kpis.nps >= 50 ? 'success' : kpis.nps >= 0 ? 'warning' : 'destructive'}
                highlight
              />
              <KpiCard
                label="Total respostas"
                value={kpis.total}
                icon={<MessageSquare className="w-4 h-4" />}
              />
              <KpiCard
                label="Nota média"
                value={kpis.media}
                icon={<Star className="w-4 h-4" />}
              />
              <KpiCard
                label="Promotores"
                value={kpis.promotores}
                suffix={` (${kpis.promPct}%)`}
                tone="success"
                icon={<Users className="w-4 h-4" />}
              />
              <KpiCard
                label="Passivos"
                value={kpis.passivos}
                suffix={` (${kpis.pasPct}%)`}
                tone="warning"
              />
              <KpiCard
                label="Detratores"
                value={kpis.detratores}
                suffix={` (${kpis.detPct}%)`}
                tone="destructive"
              />
            </div>

            {/* Estrelas médias */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KpiCard label="Estrutura (média ★)" value={kpis.estrutura} />
              <KpiCard label="Equipe (média ★)" value={kpis.equipe} />
              <KpiCard label="Treino (média ★)" value={kpis.treino} />
            </div>

            {kpis.total === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-sm text-muted-foreground">
                  Nenhuma resposta no período selecionado.
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Evolução */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Evolução no período</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolucao}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" domain={[-100, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="total"
                          name="Respostas"
                          stroke={COLORS.primary}
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="nps"
                          name="NPS"
                          stroke={COLORS.promotor}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Distribuição categorias */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Distribuição por categoria</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={distribuicaoCategoria}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={(d: any) => `${d.name}: ${d.value}`}
                          >
                            {distribuicaoCategoria.map((d) => (
                              <Cell key={d.name} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Distribuição de notas */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Distribuição de notas (0–10)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distribuicaoNotas}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="nota" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              background: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="qtd" name="Respostas">
                            {distribuicaoNotas.map((b) => (
                              <Cell
                                key={b.nota}
                                fill={
                                  b.nota <= 6
                                    ? COLORS.detrator
                                    : b.nota <= 8
                                    ? COLORS.passivo
                                    : COLORS.promotor
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function KpiCard({
  label,
  value,
  suffix = '',
  tone,
  highlight,
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: 'success' | 'warning' | 'destructive';
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  const toneCls =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
      ? 'text-warning'
      : tone === 'destructive'
      ? 'text-destructive'
      : highlight
      ? 'text-primary'
      : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <div className={cn('text-2xl font-bold mt-1', toneCls)}>
          {value}
          {suffix}
        </div>
      </CardContent>
    </Card>
  );
}
