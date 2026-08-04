import { useMemo, useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  CalendarIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  Eye,
  Star,
  MessageSquare,
  Building2,
  Phone,
  User,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDebounce } from '@/hooks/use-debounce';

type Resposta = {
  id: string;
  nome: string;
  whatsapp: string;
  lead_id: string | null;
  lead_nome: string | null;
  unidade_id: string | null;
  unidade_nome: string;
  nota_nps: number;
  estrelas_estrutura: number | null;
  estrelas_equipe: number | null;
  estrelas_treino: number | null;
  pontos_positivos: string[] | null;
  pontos_melhoria: string[] | null;
  tempo_aluno: string | null;
  categoria: 'detrator' | 'passivo' | 'promotor';
  comentario: string | null;
  created_at: string;
};

type Unidade = { id: string; nome: string };

const PAGE_SIZE = 20;

function categoriaCls(cat: string) {
  if (cat === 'promotor') return 'bg-success text-success-foreground';
  if (cat === 'passivo') return 'bg-warning text-warning-foreground';
  return 'bg-destructive text-destructive-foreground';
}

export default function NpsCrm() {
  const [search, setSearch] = useState('');
  const { unidadeAtual } = useUnidade();
  const [unidade, setUnidade] = useState<string>(unidadeAtual?.id ?? '');

  // A visualização é sempre restrita à unidade ativa selecionada no menu
  useEffect(() => {
    if (unidadeAtual?.id) setUnidade(unidadeAtual.id);
  }, [unidadeAtual?.id]);
  const [categoria, setCategoria] = useState('todas');
  const [vinculo, setVinculo] = useState<'todos' | 'com_lead' | 'sem_lead'>('todos');
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Resposta | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data: unidades = [] } = useQuery({
    queryKey: ['nps-crm-unidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return (data ?? []) as Unidade[];
    },
  });

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim(),
      unidade,
      categoria,
      vinculo,
      from: range.from?.toISOString(),
      to: range.to ? new Date(range.to.getTime() + 86400000 - 1).toISOString() : undefined,
    }),
    [debouncedSearch, unidade, categoria, vinculo, range],
  );

  // Reset page when filters change
  useMemo(() => {
    setPage(0);
  }, [filters]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['nps-crm-list', filters, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from('nps_respostas')
        .select(
          'id, nome, whatsapp, lead_id, lead_nome, unidade_id, unidade_nome, nota_nps, estrelas_estrutura, estrelas_equipe, estrelas_treino, pontos_positivos, pontos_melhoria, tempo_aluno, categoria, comentario, created_at',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (filters.unidade !== 'todas') q = q.eq('unidade_id', filters.unidade);
      if (filters.categoria !== 'todas') q = q.eq('categoria', filters.categoria);
      if (filters.vinculo === 'com_lead') q = q.not('lead_id', 'is', null);
      if (filters.vinculo === 'sem_lead') q = q.is('lead_id', null);
      if (filters.from) q = q.gte('created_at', filters.from);
      if (filters.to) q = q.lte('created_at', filters.to);

      if (filters.search) {
        const digits = filters.search.replace(/\D/g, '');
        const term = `%${filters.search}%`;
        const ors = [
          `nome.ilike.${term}`,
          `lead_nome.ilike.${term}`,
          `comentario.ilike.${term}`,
        ];
        if (digits.length >= 3) ors.push(`whatsapp.ilike.%${digits}%`);
        q = q.or(ors.join(','));
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Resposta[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const unidadeNomeById = useMemo(() => {
    const m = new Map<string, string>();
    unidades.forEach((u) => m.set(u.id, u.nome));
    return m;
  }, [unidades]);

  const hasFilters =
    !!filters.search ||
    filters.unidade !== 'todas' ||
    filters.categoria !== 'todas' ||
    filters.vinculo !== 'todos' ||
    !!range.from ||
    !!range.to;

  const limparFiltros = () => {
    setSearch('');
    setUnidade('todas');
    setCategoria('todas');
    setVinculo('todos');
    setRange({});
    setPage(0);
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">CRM NPS</h1>
            <p className="text-muted-foreground text-sm">
              Pesquise respostas por lead, WhatsApp, comentário ou data
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/nps/dashboard">
              <Button variant="outline" size="sm">Dashboard</Button>
            </Link>
            <Link to="/nps/respostas">
              <Button variant="outline" size="sm">Visão completa</Button>
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, lead, WhatsApp ou comentário…"
                  className="pl-9"
                />
              </div>
              <div className="min-w-[180px]">
                <Select value={unidade} onValueChange={setUnidade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <div className="min-w-[160px]">
                <Select value={vinculo} onValueChange={(v) => setVinculo(v as typeof vinculo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os vínculos</SelectItem>
                    <SelectItem value="com_lead">Com lead vinculado</SelectItem>
                    <SelectItem value="sem_lead">Sem lead vinculado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {range.from ? format(range.from, 'dd/MM/yy') : 'Data inicial'}
                    {' — '}
                    {range.to ? format(range.to, 'dd/MM/yy') : 'Data final'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={range as any}
                    onSelect={(r: any) => setRange(r ?? {})}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1">
                  <X className="w-4 h-4" /> Limpar
                </Button>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {isFetching ? 'Atualizando…' : `${total} resposta${total === 1 ? '' : 's'} encontrada${total === 1 ? '' : 's'}`}
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                Nenhuma resposta encontrada com os filtros atuais.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Aluno / Nome informado</TableHead>
                    <TableHead>Lead vinculado</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-center">Nota</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Comentário</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const unidadeNome =
                      (r.unidade_id && unidadeNomeById.get(r.unidade_id)) || r.unidade_nome;
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelected(r)}
                      >
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(r.created_at), 'dd/MM/yy HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {r.lead_id ? (
                            <Link
                              to={`/lead/${r.lead_id}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                            >
                              {r.lead_nome ?? 'Abrir lead'}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem vínculo</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{r.whatsapp}</TableCell>
                        <TableCell className="text-xs">{unidadeNome}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn('font-bold', categoriaCls(r.categoria))}>
                            {r.nota_nps}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{r.categoria}</TableCell>
                        <TableCell className="max-w-[320px]">
                          <span
                            className="text-xs text-muted-foreground line-clamp-2"
                            title={r.comentario ?? ''}
                          >
                            {r.comentario || '—'}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelected(r)}
                            aria-label="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Paginação */}
        {total > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Página {page + 1} de {totalPages} · Exibindo {rows.length} de {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1 || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <NpsDetailDialog
          resposta={selected}
          unidadeNomeById={unidadeNomeById}
          onClose={() => setSelected(null)}
        />
      </div>
    </Layout>
  );
}

function Stars({ value }: { value: number | null }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'w-4 h-4',
            i < v ? 'fill-warning text-warning' : 'text-muted-foreground/30',
          )}
        />
      ))}
      <span className="ml-2 text-xs text-muted-foreground">{v}/5</span>
    </div>
  );
}

function NpsDetailDialog({
  resposta,
  unidadeNomeById,
  onClose,
}: {
  resposta: Resposta | null;
  unidadeNomeById: Map<string, string>;
  onClose: () => void;
}) {
  const r = resposta;
  const unidadeNome = r
    ? (r.unidade_id && unidadeNomeById.get(r.unidade_id)) || r.unidade_nome
    : '';

  return (
    <Dialog open={!!r} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {r && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between gap-3 pr-6">
                <div>
                  <DialogTitle className="text-xl">Resposta NPS</DialogTitle>
                  <DialogDescription>
                    {format(new Date(r.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </DialogDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={cn('text-lg font-bold px-3 py-1', categoriaCls(r.categoria))}>
                    {r.nota_nps}
                  </Badge>
                  <span className="text-xs capitalize text-muted-foreground">{r.categoria}</span>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Identificação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Nome informado</div>
                    <div className="text-sm font-medium">{r.nome}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">WhatsApp</div>
                    <div className="text-sm font-medium">{r.whatsapp}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Unidade</div>
                    <div className="text-sm font-medium">{unidadeNome}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Tempo como aluno</div>
                    <div className="text-sm font-medium">{r.tempo_aluno || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Lead vinculado */}
              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">Lead vinculado</div>
                {r.lead_id ? (
                  <Link
                    to={`/lead/${r.lead_id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    {r.lead_nome ?? 'Abrir lead'}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Nenhum lead encontrado para este WhatsApp na unidade.
                  </span>
                )}
              </div>

              {/* Avaliações por estrelas */}
              <div className="space-y-2">
                <div className="text-sm font-semibold">Avaliação detalhada</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Estrutura</div>
                    <Stars value={r.estrelas_estrutura} />
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Equipe</div>
                    <Stars value={r.estrelas_equipe} />
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Treino</div>
                    <Stars value={r.estrelas_treino} />
                  </div>
                </div>
              </div>

              {/* Pontos positivos / melhoria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground mb-2">Pontos positivos</div>
                  {r.pontos_positivos && r.pontos_positivos.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {r.pontos_positivos.map((p, i) => (
                        <Badge key={i} variant="secondary" className="bg-success/15 text-success border-success/30">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground mb-2">Pontos de melhoria</div>
                  {r.pontos_melhoria && r.pontos_melhoria.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {r.pontos_melhoria.map((p, i) => (
                        <Badge key={i} variant="secondary" className="bg-warning/15 text-warning border-warning/30">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              {/* Comentário */}
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">Comentário</div>
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {r.comentario || <span className="text-muted-foreground">Sem comentário.</span>}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
