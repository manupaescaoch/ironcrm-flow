import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { History, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Insumo = {
  id: string;
  codigo_insumo: string;
  nome_insumo: string;
};

type Movimentacao = {
  id: string;
  insumo_id: string;
  tipo: string;
  quantidade: number;
  setor: string | null;
  responsavel: string;
  observacao: string | null;
  created_at: string;
};

interface HistoricoMovimentacoesProps {
  insumos: Insumo[];
}

export function HistoricoMovimentacoes({ insumos }: HistoricoMovimentacoesProps) {
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroInsumo, setFiltroInsumo] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Fetch todas movimentações do período
  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ['historico_movimentacoes', dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .gte('created_at', startOfDay(new Date(dataInicio)).toISOString())
        .lte('created_at', endOfDay(new Date(dataFim)).toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Movimentacao[];
    },
  });

  // Extrair responsáveis únicos para o filtro
  const responsaveisUnicos = useMemo(() => {
    const responsaveis = new Set(movimentacoes.map(m => m.responsavel));
    return Array.from(responsaveis).sort();
  }, [movimentacoes]);

  // Filtrar movimentações
  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter(m => {
      if (filtroResponsavel && !m.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return false;
      if (filtroInsumo !== 'todos' && m.insumo_id !== filtroInsumo) return false;
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
      if (filtroSetor !== 'todos' && m.setor !== filtroSetor) return false;
      return true;
    });
  }, [movimentacoes, filtroResponsavel, filtroInsumo, filtroTipo, filtroSetor]);

  const getInsumoNome = (insumoId: string) => {
    const insumo = insumos.find(i => i.id === insumoId);
    return insumo?.nome_insumo || 'Insumo não encontrado';
  };

  const getInsumoCodigo = (insumoId: string) => {
    const insumo = insumos.find(i => i.id === insumoId);
    return insumo?.codigo_insumo || '';
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'entrada':
        return <Badge className="bg-green-500">Entrada</Badge>;
      case 'retirada':
        return <Badge variant="destructive">Retirada</Badge>;
      case 'ajuste':
        return <Badge variant="secondary">Ajuste</Badge>;
      default:
        return <Badge>{tipo}</Badge>;
    }
  };

  const limparFiltros = () => {
    setFiltroResponsavel('');
    setFiltroInsumo('todos');
    setFiltroTipo('todos');
    setFiltroSetor('todos');
    setDataInicio(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setDataFim(format(new Date(), 'yyyy-MM-dd'));
  };

  const temFiltrosAtivos = filtroResponsavel || filtroInsumo !== 'todos' || filtroTipo !== 'todos' || filtroSetor !== 'todos';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Movimentações
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {movimentacoesFiltradas.length} registro(s)
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <Label className="text-xs">Data Início</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Data Fim</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Responsável</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={filtroResponsavel}
                onChange={e => setFiltroResponsavel(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Insumo</Label>
            <Select value={filtroInsumo} onValueChange={setFiltroInsumo}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {insumos.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.nome_insumo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="retirada">Retirada</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Setor</Label>
            <Select value={filtroSetor} onValueChange={setFiltroSetor}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Limpeza">Limpeza</SelectItem>
                <SelectItem value="Café">Café</SelectItem>
                <SelectItem value="Treino">Treino</SelectItem>
                <SelectItem value="Administrativo">Administrativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {temFiltrosAtivos && (
          <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1">
            <X className="h-4 w-4" />
            Limpar filtros
          </Button>
        )}

        {/* Tabela */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Insumo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : movimentacoesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma movimentação encontrada no período.
                  </TableCell>
                </TableRow>
              ) : (
                movimentacoesFiltradas.map(mov => (
                  <TableRow key={mov.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{format(new Date(mov.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                        <p className="text-xs text-muted-foreground">{format(new Date(mov.created_at), "HH:mm", { locale: ptBR })}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{getInsumoNome(mov.insumo_id)}</span>
                        <p className="text-xs text-muted-foreground">{getInsumoCodigo(mov.insumo_id)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getTipoBadge(mov.tipo)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {mov.tipo === 'retirada' ? `-${mov.quantidade}` : mov.tipo === 'entrada' ? `+${mov.quantidade}` : mov.quantidade}
                    </TableCell>
                    <TableCell>{mov.setor || '—'}</TableCell>
                    <TableCell>{mov.responsavel}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={mov.observacao || ''}>
                      {mov.observacao || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
