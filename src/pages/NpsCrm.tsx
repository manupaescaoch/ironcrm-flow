import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
  const [unidade, setUnidade] = useState('todas');
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
          'id, nome, whatsapp, lead_id, lead_nome, unidade_id, unidade_nome, nota_nps, categoria, comentario, created_at',
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
                    <SelectItem value="todas">Todas as unidades</SelectItem>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const unidadeNome =
                      (r.unidade_id && unidadeNomeById.get(r.unidade_id)) || r.unidade_nome;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(r.created_at), 'dd/MM/yy HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell>
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
      </div>
    </Layout>
  );
}
