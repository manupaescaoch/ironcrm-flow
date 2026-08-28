import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Star, CalendarIcon, Loader2, ChevronRight, ChevronLeft, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Resposta = {
  id: string;
  nome: string;
  whatsapp: string;
  unidade_id: string | null;
  unidade_nome: string;
  nota_nps: number;
  estrelas_estrutura: number;
  estrelas_equipe: number;
  estrelas_treino: number;
  pontos_positivos: string[];
  pontos_melhoria: string[];
  tempo_aluno: string;
  comentario: string | null;
  categoria: 'detrator' | 'passivo' | 'promotor';
  created_at: string;
};

type Unidade = { id: string; nome: string };

function categoriaBadge(cat: string) {
  if (cat === 'promotor') return 'bg-success text-success-foreground';
  if (cat === 'passivo') return 'bg-warning text-warning-foreground';
  return 'bg-destructive text-destructive-foreground';
}

function StarsInline({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn('w-3 h-3', s <= value ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />
      ))}
    </div>
  );
}

export default function NpsRespostas() {
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();
  const [unidade, setUnidade] = useState<string>(unidadeAtual?.id ?? '');

  // A visualização é sempre restrita à unidade ativa selecionada no menu
  useEffect(() => {
    if (unidadeAtual?.id) setUnidade(unidadeAtual.id);
  }, [unidadeAtual?.id]);
  const [periodo, setPeriodo] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [categoria, setCategoria] = useState<string>('todas');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [selected, setSelected] = useState<Resposta | null>(null);

  // Paginação e ordenação
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  type SortField = 'created_at' | 'nota_nps' | 'nome';
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortAsc((v) => !v);
    else { setSortField(f); setSortAsc(f === 'nome'); }
    setPage(1);
  };
  // Resetar página ao mudar filtros
  useEffect(() => { setPage(1); }, [unidade, periodo, categoria, customRange.from?.getTime(), customRange.to?.getTime()]);

  const { from, to } = useMemo(() => {
    if (periodo === 'custom') return { from: customRange.from, to: customRange.to };
    const days = parseInt(periodo);
    const f = new Date();
    f.setDate(f.getDate() - days);
    f.setHours(0, 0, 0, 0);
    return { from: f, to: new Date() };
  }, [periodo, customRange]);

  // Unidades visíveis ao usuário (RLS já restringe coordenador à própria unidade)
  const { data: unidades = [] } = useQuery({
    queryKey: ['nps-unidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return (data ?? []) as Unidade[];
    },
  });

  // KPIs: busca leve de todas as respostas do período (apenas categoria/unidade)
  const { data: kpiRows = [] } = useQuery({
    queryKey: ['nps-respostas-kpi', unidade, from?.toISOString(), to?.toISOString(), categoria],
    enabled: !!unidade,
    queryFn: async () => {
      let q = supabase.from('nps_respostas').select('categoria, unidade_id');
      q = q.eq('unidade_id', unidade);
      if (categoria !== 'todas') q = q.eq('categoria', categoria);
      if (from) q = q.gte('created_at', from.toISOString());
      if (to) q = q.lte('created_at', to.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { categoria: Resposta['categoria']; unidade_id: string | null }[];
    },
  });

  // Lista paginada e ordenada no servidor
  const { data: pageData, isLoading } = useQuery({
    queryKey: ['nps-respostas', unidade, from?.toISOString(), to?.toISOString(), categoria, page, sortField, sortAsc],
    enabled: !!unidade,
    queryFn: async () => {
      let q = supabase
        .from('nps_respostas')
        .select('*', { count: 'exact' })
        .order(sortField, { ascending: sortAsc })
        .order('created_at', { ascending: false }) // desempate estável
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      q = q.eq('unidade_id', unidade);
      if (categoria !== 'todas') q = q.eq('categoria', categoria);
      if (from) q = q.gte('created_at', from.toISOString());
      if (to) q = q.lte('created_at', to.toISOString());
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Resposta[], total: count ?? 0 };
    },
  });
  const respostas = pageData?.rows ?? [];
  const totalCount = pageData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const unidadeNomeById = useMemo(() => {
    const m = new Map<string, string>();
    unidades.forEach((u) => m.set(u.id, u.nome));
    return m;
  }, [unidades]);

  const kpis = useMemo(() => {
    const total = kpiRows.length;
    const calc = (list: typeof kpiRows) => {
      const n = list.length;
      if (!n) return { nps: 0, prom: 0, pas: 0, det: 0, total: 0 };
      const prom = list.filter((r) => r.categoria === 'promotor').length;
      const pas = list.filter((r) => r.categoria === 'passivo').length;
      const det = list.filter((r) => r.categoria === 'detrator').length;
      return {
        nps: Math.round((prom / n) * 100 - (det / n) * 100),
        prom: Math.round((prom / n) * 100),
        pas: Math.round((pas / n) * 100),
        det: Math.round((det / n) * 100),
        total: n,
      };
    };
    const porUnidade = unidades.filter((u) => u.id === unidade).map((u) => ({
      unidade: u,
      stats: calc(kpiRows.filter((r) => r.unidade_id === u.id)),
    }));
    return { geral: calc(kpiRows), porUnidade, total };
  }, [kpiRows, unidades, unidade]);

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Respostas NPS</h1>
          <p className="text-muted-foreground text-sm">Avaliações dos alunos da EVO TRAINING CLUB</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <KpiCard label="Score NPS" value={kpis.geral.nps} suffix="" highlight />
          {kpis.porUnidade.map(({ unidade: u, stats }) => (
            <KpiCard key={u.id} label={`NPS ${u.nome}`} value={stats.nps} suffix="" />
          ))}
          <KpiCard label="Total respostas" value={kpis.total} />
          <KpiCard label="% Promotores" value={kpis.geral.prom} suffix="%" tone="success" />
          <KpiCard label="% Passivos" value={kpis.geral.pas} suffix="%" tone="warning" />
          <KpiCard label="% Detratores" value={kpis.geral.det} suffix="%" tone="destructive" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <div className="min-w-[200px]">
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
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
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodo === 'custom' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {customRange.from ? format(customRange.from, 'dd/MM') : 'Início'}
                    {' — '}
                    {customRange.to ? format(customRange.to, 'dd/MM') : 'Fim'}
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
            <div className="min-w-[160px]">
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas categorias</SelectItem>
                  <SelectItem value="promotor">Promotores</SelectItem>
                  <SelectItem value="passivo">Passivos</SelectItem>
                  <SelectItem value="detrator">Detratores</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Avaliações ({respostas.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : respostas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma avaliação no período.</div>
            ) : (
              <div className="divide-y rounded-lg border">
                {respostas.map((r) => {
                  const resumo = r.comentario?.trim()
                    ? r.comentario.trim()
                    : r.pontos_melhoria?.length
                      ? `Melhorar: ${r.pontos_melhoria.join(', ')}`
                      : r.pontos_positivos?.length
                        ? `Destaques: ${r.pontos_positivos.slice(0, 3).join(', ')}`
                        : 'Sem comentários';
                  return (
                    <button
                      key={r.id}
                      onClick={() => navigate(`/nps/respostas/${r.id}`)}
                      className="w-full text-left flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                    >
                      <Badge className={cn('font-bold shrink-0 w-9 justify-center', categoriaBadge(r.categoria))}>
                        {r.nota_nps}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{r.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "dd/MM/yy 'às' HH:mm")} · {r.tempo_aluno}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{resumo}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>

        </Card>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selected.nome}
                    <Badge className={cn('font-bold', categoriaBadge(selected.categoria))}>
                      {selected.nota_nps}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <Info label="Unidade" value={(selected.unidade_id && unidadeNomeById.get(selected.unidade_id)) || selected.unidade_nome} />
                    <Info label="WhatsApp" value={selected.whatsapp} />
                    <Info label="Tempo de aluno" value={selected.tempo_aluno} />
                    <Info label="Data" value={format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm")} />
                  </div>

                  <div className="rounded-lg border p-3 space-y-2">
                    {[
                      ['Estrutura', selected.estrelas_estrutura],
                      ['Equipe', selected.estrelas_equipe],
                      ['Treino', selected.estrelas_treino],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
                        <StarsInline value={value as number} />
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pontos positivos</div>
                    <div className="flex flex-wrap gap-1">
                      {selected.pontos_positivos.length
                        ? selected.pontos_positivos.map((p) => (
                            <Badge key={p} variant="outline" className="text-[11px] border-success/40 text-success">{p}</Badge>
                          ))
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pontos de melhoria</div>
                    <div className="flex flex-wrap gap-1">
                      {selected.pontos_melhoria.length
                        ? selected.pontos_melhoria.map((p) => (
                            <Badge key={p} variant="outline" className="text-[11px] border-warning/40 text-warning">{p}</Badge>
                          ))
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Comentário</div>
                    <p className="text-sm text-muted-foreground italic">
                      {selected.comentario || '—'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}


function KpiCard({
  label,
  value,
  suffix = '',
  tone,
  highlight,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: 'success' | 'warning' | 'destructive';
  highlight?: boolean;
}) {
  const toneCls =
    tone === 'success' ? 'text-success' :
    tone === 'warning' ? 'text-warning' :
    tone === 'destructive' ? 'text-destructive' :
    highlight ? 'text-primary' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={cn('text-2xl font-bold mt-1', toneCls)}>{value}{suffix}</div>
      </CardContent>
    </Card>
  );
}
