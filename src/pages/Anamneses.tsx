import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardList, Loader2, Eye, ExternalLink, Search } from 'lucide-react';
import { format } from 'date-fns';

type Anamnese = {
  id: string;
  lead_id: string | null;
  unidade_id: string | null;
  nome: string | null;
  data_nascimento: string | null;
  objetivo: string | null;
  historico: string | null;
  frequencia_atual: string | null;
  obstaculo: string | null;
  dias_semana: string | null;
  preferencia_horario: string[] | null;
  tem_condicao_saude: boolean | null;
  condicao_saude_descricao: string | null;
  tem_lesao: boolean | null;
  lesao_descricao: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  leads?: { nome: string | null; telefone: string | null } | null;
};

type Unidade = { id: string; nome: string };

const NA = 'Não informado';
const PAGE_SIZE = 50;
const TODAS = 'todas';

function fmt(v: string | null | undefined) {
  return v && v.trim().length > 0 ? v : NA;
}

function fmtDate(v: string | null | undefined) {
  if (!v) return NA;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : NA;
}

function fmtBoolDescricao(b: boolean | null, descr: string | null) {
  if (b === null) return NA;
  if (!b) return 'Não';
  return `Sim — ${descr && descr.trim().length > 0 ? descr : 'sem descrição'}`;
}

export default function Anamneses() {
  const navigate = useNavigate();
  const { unidadeAtual } = useUnidade();
  const [unidade, setUnidade] = useState<string>(unidadeAtual?.id ?? '');
  const [busca, setBusca] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Anamnese | null>(null);

  useEffect(() => {
    if (unidadeAtual?.id) setUnidade(unidadeAtual.id);
  }, [unidadeAtual?.id]);

  useEffect(() => {
    setPage(1);
  }, [unidade, busca, de, ate]);

  const { data: unidades = [] } = useQuery({
    queryKey: ['anamneses-unidades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades').select('id, nome').order('nome');
      if (error) throw error;
      return (data ?? []) as Unidade[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['anamneses-lista', unidade, busca, de, ate, page],
    enabled: !!unidade,
    queryFn: async () => {
      let q = supabase
        .from('anamneses_experimental')
        .select('*, leads(nome, telefone)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (unidade !== TODAS) q = q.eq('unidade_id', unidade);
      if (busca.trim()) q = q.ilike('nome', `%${busca.trim()}%`);
      if (de) q = q.gte('created_at', `${de}T00:00:00`);
      if (ate) q = q.lte('created_at', `${ate}T23:59:59`);
      const { data: rows, error, count } = await q;
      if (error) throw error;
      return { rows: (rows ?? []) as unknown as Anamnese[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const unidadeNome = useMemo(
    () =>
      unidade === TODAS
        ? 'Todas as unidades'
        : unidades.find((u) => u.id === unidade)?.nome ?? '',
    [unidades, unidade],
  );


  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Anamneses</h1>
          <p className="text-muted-foreground text-sm">
            Fichas preenchidas pelos alunos antes da aula experimental
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <div className="min-w-[220px]">
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as unidades</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="w-[150px]"
                value={de}
                onChange={(e) => setDe(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="date"
                className="w-[150px]"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
              />
              {(de || ate) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDe('');
                    setAte('');
                  }}
                >
                  Limpar
                </Button>
              )}
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {unidadeNome ? `Respostas — ${unidadeNome}` : 'Respostas'}
            </CardTitle>
            <Badge variant="secondary">{total} ficha(s)</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma anamnese encontrada para esta unidade.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Telefone</th>
                      <th className="px-4 py-3">Objetivo</th>
                      <th className="px-4 py-3">Saúde</th>
                      <th className="px-4 py-3">Enviada em</th>
                      <th className="px-4 py-3 text-right">Ficha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">{fmt(a.nome ?? a.leads?.nome)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmt(a.leads?.telefone)}
                        </td>
                        <td className="px-4 py-3 max-w-[280px] truncate">{fmt(a.objetivo)}</td>
                        <td className="px-4 py-3">
                          {a.tem_condicao_saude || a.tem_lesao ? (
                            <Badge className="bg-warning text-warning-foreground">Atenção</Badge>
                          ) : (
                            <Badge variant="secondary">Ok</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {format(new Date(a.created_at), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelected(a)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Abrir ficha
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{fmt(selected?.nome ?? selected?.leads?.nome)}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Telefone" value={fmt(selected.leads?.telefone)} />
              <Field label="Data de nascimento" value={fmtDate(selected.data_nascimento)} />
              <Field label="Objetivo" value={fmt(selected.objetivo)} />
              <Field label="Histórico" value={fmt(selected.historico)} />
              <Field label="Frequência atual" value={fmt(selected.frequencia_atual)} />
              <Field label="Maior obstáculo" value={fmt(selected.obstaculo)} />
              <Field label="Disponibilidade" value={fmt(selected.dias_semana)} />
              <Field
                label="Preferência de horário"
                value={
                  selected.preferencia_horario && selected.preferencia_horario.length > 0
                    ? selected.preferencia_horario.join(', ')
                    : NA
                }
              />
              <Field
                label="Condição de saúde"
                value={fmtBoolDescricao(
                  selected.tem_condicao_saude,
                  selected.condicao_saude_descricao,
                )}
              />
              <Field
                label="Lesão / limitação"
                value={fmtBoolDescricao(selected.tem_lesao, selected.lesao_descricao)}
              />
              <Field
                label="Observações"
                value={fmt(selected.observacoes)}
                className="md:col-span-2"
              />
              <p className="text-xs text-muted-foreground md:col-span-2">
                Enviada em {format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm")}
              </p>
              {selected.lead_id && (
                <div className="md:col-span-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/lead/${selected.lead_id}`)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ver cadastro do lead
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
