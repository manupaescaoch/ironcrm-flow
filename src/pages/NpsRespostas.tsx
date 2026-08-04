import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Star, CalendarIcon, Loader2 } from 'lucide-react';
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
  const { unidadeAtual } = useUnidade();
  const [unidade, setUnidade] = useState<string>(unidadeAtual?.id ?? '');

  // A visualização é sempre restrita à unidade ativa selecionada no menu
  useEffect(() => {
    if (unidadeAtual?.id) setUnidade(unidadeAtual.id);
  }, [unidadeAtual?.id]);
  const [periodo, setPeriodo] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [categoria, setCategoria] = useState<string>('todas');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

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

  const { data: respostas = [], isLoading } = useQuery({
    queryKey: ['nps-respostas', unidade, from?.toISOString(), to?.toISOString(), categoria],
    queryFn: async () => {
      let q = supabase.from('nps_respostas').select('*').order('created_at', { ascending: false });
      if (unidade !== 'todas') q = q.eq('unidade_id', unidade);
      if (categoria !== 'todas') q = q.eq('categoria', categoria);
      if (from) q = q.gte('created_at', from.toISOString());
      if (to) q = q.lte('created_at', to.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Resposta[];
    },
  });

  const unidadeNomeById = useMemo(() => {
    const m = new Map<string, string>();
    unidades.forEach((u) => m.set(u.id, u.nome));
    return m;
  }, [unidades]);

  const kpis = useMemo(() => {
    const total = respostas.length;
    const calc = (list: Resposta[]) => {
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
    const porUnidade = unidades.map((u) => ({
      unidade: u,
      stats: calc(respostas.filter((r) => r.unidade_id === u.id)),
    }));
    return { geral: calc(respostas), porUnidade, total };
  }, [respostas, unidades]);

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Respostas NPS</h1>
          <p className="text-muted-foreground text-sm">Avaliações dos alunos da Iron Lifting Club</p>
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
          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : respostas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma avaliação no período.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Estrutura</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Treino</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Positivos</TableHead>
                    <TableHead>Melhorias</TableHead>
                    <TableHead>Comentário</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {respostas.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-xs">
                        {(r.unidade_id && unidadeNomeById.get(r.unidade_id)) || r.unidade_nome}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('font-bold', categoriaBadge(r.categoria))}>{r.nota_nps}</Badge>
                      </TableCell>
                      <TableCell><StarsInline value={r.estrelas_estrutura} /></TableCell>
                      <TableCell><StarsInline value={r.estrelas_equipe} /></TableCell>
                      <TableCell><StarsInline value={r.estrelas_treino} /></TableCell>
                      <TableCell className="text-xs">{r.tempo_aluno}</TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {r.pontos_positivos.map((p) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {r.pontos_melhoria.map((p) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <span className="text-xs text-muted-foreground line-clamp-2" title={r.comentario ?? ''}>
                          {r.comentario || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(r.created_at), 'dd/MM/yy HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
