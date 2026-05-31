import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useReunioesData, type Reuniao } from '@/hooks/useReunioesData';
import { TIPOS_REUNIAO, STATUS_REUNIAO } from './constants';
import { ReuniaoStatusBadge } from './EncaminhamentoStatusBadge';
import { ReuniaoDetalheDrawer } from './ReuniaoDetalheDrawer';

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

function stripHtml(s: string | null | undefined) {
  if (!s) return '';
  return s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function ReunioesHistorico() {
  const { reunioes, loading, deleteReuniao } = useReunioesData();
  const { unidades, unidadesPermitidas, hasMultipleUnidades } = useUnidade();
  const { isAdmin } = useAuth();
  const unidadesFiltro = isAdmin ? unidades : unidadesPermitidas;
  const showUnidadeFilter = isAdmin || hasMultipleUnidades;

  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [unidadeFilter, setUnidadeFilter] = useState<string>('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [selected, setSelected] = useState<Reuniao | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    return reunioes.filter((r) => {
      if (tipo !== 'all' && r.tipo !== tipo) return false;
      if (status !== 'all' && r.status !== status) return false;
      if (unidadeFilter !== 'all' && r.unidade_id !== unidadeFilter) return false;
      if (dataInicio && r.data < dataInicio) return false;
      if (dataFim && r.data > dataFim) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.tipo} ${r.responsavel ?? ''} ${stripHtml(r.pauta)} ${stripHtml(r.feedback)} ${r.participantes.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reunioes, tipo, status, unidadeFilter, dataInicio, dataFim, search]);

  const openDetalhe = (r: Reuniao) => {
    setSelected(r);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TIPOS_REUNIAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_REUNIAO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
              <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 md:max-w-md">
          <div>
            <label className="text-xs text-muted-foreground">De</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Até</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma reunião encontrada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Participantes</TableHead>
                <TableHead>Pauta</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const unidadeNome = unidades.find((u) => u.id === r.unidade_id)?.nome ?? '—';
                return (
                  <TableRow key={r.id} onClick={() => openDetalhe(r)} className="cursor-pointer">
                    <TableCell className="font-medium">{r.tipo}</TableCell>
                    <TableCell>{formatDate(r.data)}</TableCell>
                    <TableCell>{unidadeNome}</TableCell>
                    <TableCell className="text-sm">{r.responsavel ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {r.participantes.slice(0, 2).map((p, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] font-normal">{p}</Badge>
                        ))}
                        {r.participantes.length > 2 && (
                          <Badge variant="outline" className="text-[10px]">+{r.participantes.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                      {stripHtml(r.pauta) || '—'}
                    </TableCell>
                    <TableCell><ReuniaoStatusBadge status={r.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ReuniaoDetalheDrawer
        reuniao={selected}
        open={open}
        onOpenChange={setOpen}
        onDelete={deleteReuniao}
      />
    </div>
  );
}
