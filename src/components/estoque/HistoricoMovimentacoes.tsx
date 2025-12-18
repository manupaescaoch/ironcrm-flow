import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { History, Search, X, ChevronDown, ChevronUp, Plus, Minus, Settings, ArrowUpDown, Filter, Calendar, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUnidade } from '@/contexts/UnidadeContext';

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

const ITEMS_PER_PAGE = 15;

export function HistoricoMovimentacoes({ insumos }: HistoricoMovimentacoesProps) {
  const { unidadeAtual } = useUnidade();
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroInsumo, setFiltroInsumo] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [itemsVisiveis, setItemsVisiveis] = useState(ITEMS_PER_PAGE);

  // Fetch todas movimentações do período
  const { data: movimentacoes = [], isLoading, refetch } = useQuery({
    queryKey: ['historico_movimentacoes', dataInicio, dataFim, unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('unidade_id', unidadeAtual.id)
        .gte('created_at', startOfDay(new Date(dataInicio)).toISOString())
        .lte('created_at', endOfDay(new Date(dataFim)).toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: !!unidadeAtual,
  });

  // Extrair responsáveis únicos para o filtro
  const responsaveisUnicos = useMemo(() => {
    const responsaveis = new Set(movimentacoes.map(m => m.responsavel));
    return Array.from(responsaveis).sort();
  }, [movimentacoes]);

  // Filtrar movimentações
  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter(m => {
      // Busca global
      if (buscaGlobal) {
        const termo = buscaGlobal.toLowerCase();
        const insumo = insumos.find(i => i.id === m.insumo_id);
        const matchInsumo = insumo?.nome_insumo.toLowerCase().includes(termo) || insumo?.codigo_insumo.toLowerCase().includes(termo);
        const matchResponsavel = m.responsavel.toLowerCase().includes(termo);
        const matchSetor = m.setor?.toLowerCase().includes(termo);
        const matchObs = m.observacao?.toLowerCase().includes(termo);
        if (!matchInsumo && !matchResponsavel && !matchSetor && !matchObs) return false;
      }
      
      if (filtroResponsavel && !m.responsavel.toLowerCase().includes(filtroResponsavel.toLowerCase())) return false;
      if (filtroInsumo !== 'todos' && m.insumo_id !== filtroInsumo) return false;
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
      if (filtroSetor !== 'todos' && m.setor !== filtroSetor) return false;
      return true;
    });
  }, [movimentacoes, buscaGlobal, filtroResponsavel, filtroInsumo, filtroTipo, filtroSetor, insumos]);

  // KPIs do histórico
  const kpis = useMemo(() => {
    const entradas = movimentacoesFiltradas.filter(m => m.tipo === 'entrada');
    const retiradas = movimentacoesFiltradas.filter(m => m.tipo === 'retirada');
    const ajustes = movimentacoesFiltradas.filter(m => m.tipo === 'ajuste');
    
    return {
      totalMovimentacoes: movimentacoesFiltradas.length,
      totalEntradas: entradas.reduce((sum, m) => sum + m.quantidade, 0),
      totalRetiradas: retiradas.reduce((sum, m) => sum + m.quantidade, 0),
      totalAjustes: ajustes.length,
      countEntradas: entradas.length,
      countRetiradas: retiradas.length,
    };
  }, [movimentacoesFiltradas]);

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
        return (
          <Badge className="bg-success text-success-foreground gap-1">
            <Plus className="h-3 w-3" />
            Entrada
          </Badge>
        );
      case 'retirada':
        return (
          <Badge className="bg-destructive text-destructive-foreground gap-1">
            <Minus className="h-3 w-3" />
            Retirada
          </Badge>
        );
      case 'ajuste':
        return (
          <Badge variant="secondary" className="gap-1">
            <Settings className="h-3 w-3" />
            Ajuste
          </Badge>
        );
      default:
        return <Badge>{tipo}</Badge>;
    }
  };

  const limparFiltros = () => {
    setBuscaGlobal('');
    setFiltroResponsavel('');
    setFiltroInsumo('todos');
    setFiltroTipo('todos');
    setFiltroSetor('todos');
    setDataInicio(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setDataFim(format(new Date(), 'yyyy-MM-dd'));
    setItemsVisiveis(ITEMS_PER_PAGE);
  };

  const temFiltrosAtivos = buscaGlobal || filtroResponsavel || filtroInsumo !== 'todos' || filtroTipo !== 'todos' || filtroSetor !== 'todos';
  
  const movimentacoesVisiveis = movimentacoesFiltradas.slice(0, itemsVisiveis);
  const temMaisItens = itemsVisiveis < movimentacoesFiltradas.length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 border-b">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <History className="h-5 w-5 text-primary" />
            </div>
            Histórico de Movimentações
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()} title="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="font-normal">
              {movimentacoesFiltradas.length} registro(s)
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* KPIs do Histórico */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          <div className="bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-1">
              <ArrowUpDown className="h-4 w-4" />
              Total
            </div>
            <div className="text-2xl font-bold">{kpis.totalMovimentacoes}</div>
          </div>
          <div className="bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-success text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Entradas
            </div>
            <div className="text-2xl font-bold text-success">+{kpis.totalEntradas}</div>
            <div className="text-xs text-muted-foreground">{kpis.countEntradas} mov.</div>
          </div>
          <div className="bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-destructive text-sm mb-1">
              <TrendingDown className="h-4 w-4" />
              Retiradas
            </div>
            <div className="text-2xl font-bold text-destructive">-{kpis.totalRetiradas}</div>
            <div className="text-xs text-muted-foreground">{kpis.countRetiradas} mov.</div>
          </div>
          <div className="bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-1">
              <Settings className="h-4 w-4" />
              Ajustes
            </div>
            <div className="text-2xl font-bold">{kpis.totalAjustes}</div>
          </div>
        </div>

        {/* Busca e Filtros */}
        <div className="p-4 border-b space-y-4">
          {/* Busca Global + Toggle Filtros */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por insumo, responsável, setor ou observação..."
                value={buscaGlobal}
                onChange={e => setBuscaGlobal(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filtros de Tipo Rápido */}
            <div className="flex gap-2">
              {['todos', 'entrada', 'retirada', 'ajuste'].map(tipo => (
                <Button
                  key={tipo}
                  variant={filtroTipo === tipo ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFiltroTipo(tipo)}
                  className={
                    tipo === 'entrada' ? (filtroTipo === tipo ? 'bg-success hover:bg-success/90 text-success-foreground' : 'border-success/50 text-success hover:bg-success/10') :
                    tipo === 'retirada' ? (filtroTipo === tipo ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'border-destructive/50 text-destructive hover:bg-destructive/10') :
                    tipo === 'ajuste' ? (filtroTipo === tipo ? 'bg-secondary' : '') :
                    ''
                  }
                >
                  {tipo === 'entrada' && <Plus className="h-3 w-3 mr-1" />}
                  {tipo === 'retirada' && <Minus className="h-3 w-3 mr-1" />}
                  {tipo === 'ajuste' && <Settings className="h-3 w-3 mr-1" />}
                  {tipo === 'todos' ? 'Todos' : tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                </Button>
              ))}
            </div>
            
            <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Mais Filtros
                  {filtrosAbertos ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>

          {/* Filtros Avançados */}
          <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
            <CollapsibleContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-muted/30 rounded-lg mt-3">
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-1.5">
                    <Calendar className="h-3 w-3" />
                    Data Início
                  </Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={e => setDataInicio(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-1.5">
                    <Calendar className="h-3 w-3" />
                    Data Fim
                  </Label>
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={e => setDataFim(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5">Responsável</Label>
                  <Select value={filtroResponsavel || 'todos'} onValueChange={v => setFiltroResponsavel(v === 'todos' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {responsaveisUnicos.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5">Insumo</Label>
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
                  <Label className="text-xs mb-1.5">Setor</Label>
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
                      <SelectItem value="Recepção">Recepção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {temFiltrosAtivos && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {movimentacoesFiltradas.length} resultado(s)
              </span>
              <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1 h-7">
                <X className="h-3 w-3" />
                Limpar filtros
              </Button>
            </div>
          )}
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="font-semibold">Data/Hora</TableHead>
                <TableHead className="font-semibold">Insumo</TableHead>
                <TableHead className="font-semibold text-center">Tipo</TableHead>
                <TableHead className="font-semibold text-center">Qtd</TableHead>
                <TableHead className="font-semibold">Setor</TableHead>
                <TableHead className="font-semibold">Responsável</TableHead>
                <TableHead className="font-semibold">Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                    Carregando histórico...
                  </TableCell>
                </TableRow>
              ) : movimentacoesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    Nenhuma movimentação encontrada no período.
                  </TableCell>
                </TableRow>
              ) : (
                movimentacoesVisiveis.map(mov => (
                  <TableRow 
                    key={mov.id} 
                    className={`
                      transition-colors
                      ${mov.tipo === 'entrada' ? 'hover:bg-success/5' : ''}
                      ${mov.tipo === 'retirada' ? 'hover:bg-destructive/5' : ''}
                      ${mov.tipo === 'ajuste' ? 'hover:bg-muted/50' : ''}
                    `}
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium">{format(new Date(mov.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                        <p className="text-xs text-muted-foreground">{format(new Date(mov.created_at), "HH:mm", { locale: ptBR })}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-semibold">{getInsumoNome(mov.insumo_id)}</span>
                        <p className="text-xs text-muted-foreground font-mono">{getInsumoCodigo(mov.insumo_id)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{getTipoBadge(mov.tipo)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold text-lg ${
                        mov.tipo === 'entrada' ? 'text-success' : 
                        mov.tipo === 'retirada' ? 'text-destructive' : ''
                      }`}>
                        {mov.tipo === 'retirada' ? `-${mov.quantidade}` : mov.tipo === 'entrada' ? `+${mov.quantidade}` : mov.quantidade}
                      </span>
                    </TableCell>
                    <TableCell>
                      {mov.setor ? (
                        <Badge variant="outline" className="font-normal">{mov.setor}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{mov.responsavel}</TableCell>
                    <TableCell className="max-w-[200px]">
                      {mov.observacao ? (
                        <span className="text-sm text-muted-foreground line-clamp-2" title={mov.observacao}>
                          {mov.observacao}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Carregar Mais */}
        {temMaisItens && (
          <div className="p-4 text-center border-t">
            <Button 
              variant="outline" 
              onClick={() => setItemsVisiveis(prev => prev + ITEMS_PER_PAGE)}
              className="gap-2"
            >
              <ChevronDown className="h-4 w-4" />
              Carregar mais ({movimentacoesFiltradas.length - itemsVisiveis} restantes)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
