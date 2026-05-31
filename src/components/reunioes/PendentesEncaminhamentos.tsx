import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEncaminhamentosPendentes } from '@/hooks/useReunioesData';
import { TIPOS_REUNIAO, STATUS_ENCAMINHAMENTO, statusEffetivo } from './constants';
import { EncaminhamentoStatusBadge } from './EncaminhamentoStatusBadge';
import { toast } from '@/hooks/use-toast';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

export function PendentesEncaminhamentos() {
  const { items, loading, updateStatus } = useEncaminhamentosPendentes();
  const { unidades } = useUnidade();
  const { isAdmin, userRole } = useAuth();

  const [responsavel, setResponsavel] = useState('');
  const [unidadeFilter, setUnidadeFilter] = useState('all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [prazoInicio, setPrazoInicio] = useState('');
  const [prazoFim, setPrazoFim] = useState('');

  const canEdit = isAdmin || userRole === 'coordenador';

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (unidadeFilter !== 'all' && i.unidade_id !== unidadeFilter) return false;
      if (tipoFilter !== 'all' && i.reuniao.tipo !== tipoFilter) return false;
      const eff = statusEffetivo(i.prazo, i.status);
      if (statusFilter !== 'all' && eff !== statusFilter) return false;
      if (prazoInicio && (!i.prazo || i.prazo < prazoInicio)) return false;
      if (prazoFim && (!i.prazo || i.prazo > prazoFim)) return false;
      if (responsavel) {
        if (!(i.responsavel_nome ?? '').toLowerCase().includes(responsavel.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, unidadeFilter, tipoFilter, statusFilter, prazoInicio, prazoFim, responsavel]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateStatus(id, newStatus);
      toast({ title: 'Status atualizado' });
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <Input placeholder="Responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
          {isAdmin && (
            <Select value={unidadeFilter} onValueChange={setUnidadeFilter}>
              <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo de reunião" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TIPOS_REUNIAO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_ENCAMINHAMENTO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2 md:max-w-md">
          <div>
            <label className="text-xs text-muted-foreground">Prazo de</label>
            <Input type="date" value={prazoInicio} onChange={(e) => setPrazoInicio(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prazo até</label>
            <Input type="date" value={prazoFim} onChange={(e) => setPrazoFim(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nenhum encaminhamento pendente.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data reunião</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const unidadeNome = unidades.find((u) => u.id === i.unidade_id)?.nome ?? '—';
                return (
                  <TableRow key={i.id}>
                    <TableCell className="max-w-[280px]">
                      <p className="font-medium text-sm leading-snug">{i.acao}</p>
                    </TableCell>
                    <TableCell className="text-sm">{i.responsavel_nome ?? '—'}</TableCell>
                    <TableCell className="text-sm">{unidadeNome}</TableCell>
                    <TableCell className="text-sm">{i.reuniao.tipo}</TableCell>
                    <TableCell className="text-sm">{formatDate(i.reuniao.data)}</TableCell>
                    <TableCell className="text-sm">{formatDate(i.prazo)}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select value={i.status} onValueChange={(v) => handleStatusChange(i.id, v)}>
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_ENCAMINHAMENTO.filter((s) => s.value !== 'atrasado').map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <EncaminhamentoStatusBadge prazo={i.prazo} status={i.status} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
