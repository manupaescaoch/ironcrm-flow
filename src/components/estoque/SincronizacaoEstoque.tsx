import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';

type Movimentacao = {
  id: string;
  insumo_id: string;
  tipo: string;
  quantidade: number;
  created_at: string;
};

type Insumo = {
  id: string;
  codigo_insumo: string;
  nome_insumo: string;
};

type EstoqueItem = {
  insumo_id: string;
  quantidade_atual: number;
};

type Inconsistencia = {
  insumo_id: string;
  codigo: string;
  nome: string;
  estoque_registrado: number;
  estoque_esperado: number;
  diferenca: number;
  ultimo_ajuste_data: string | null;
};

export function SincronizacaoEstoque() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const { isAdmin, userName } = useAuth();
  const queryClient = useQueryClient();

  // Buscar TODAS as movimentações (não só últimos 30 dias)
  const { data: todasMovimentacoes = [], isLoading: loadingMov } = useQuery({
    queryKey: ['movimentacoes_todas', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('id, insumo_id, tipo, quantidade, created_at')
        .eq('unidade_id', unidadeAtual.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: !!unidadeAtual && open,
  });

  // Buscar insumos
  const { data: insumos = [], isLoading: loadingInsumos } = useQuery({
    queryKey: ['insumos_sync', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('insumos')
        .select('id, codigo_insumo, nome_insumo')
        .eq('unidade_id', unidadeAtual.id)
        .eq('ativo', true);
      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!unidadeAtual && open,
  });

  // Buscar estoque atual
  const { data: estoque = [], isLoading: loadingEstoque } = useQuery({
    queryKey: ['estoque_sync', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('estoque_interno')
        .select('insumo_id, quantidade_atual')
        .eq('unidade_id', unidadeAtual.id);
      if (error) throw error;
      return data as EstoqueItem[];
    },
    enabled: !!unidadeAtual && open,
  });

  // Calcular inconsistências
  const inconsistencias = useMemo<Inconsistencia[]>(() => {
    if (!insumos.length || loadingMov || loadingEstoque) return [];

    const resultado: Inconsistencia[] = [];

    for (const insumo of insumos) {
      const movs = todasMovimentacoes.filter(m => m.insumo_id === insumo.id);
      const estoqueItem = estoque.find(e => e.insumo_id === insumo.id);
      const estoque_registrado = estoqueItem?.quantidade_atual || 0;

      // Encontrar último ajuste (mais recente)
      const ajustes = movs.filter(m => m.tipo === 'ajuste').sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const ultimoAjuste = ajustes[0];
      const dataUltimoAjuste = ultimoAjuste?.created_at || null;

      let estoque_esperado: number;

      if (ultimoAjuste) {
        // Calcular a partir do último ajuste
        const entradasAposAjuste = movs
          .filter(m => m.tipo === 'entrada' && m.created_at > ultimoAjuste.created_at)
          .reduce((sum, m) => sum + m.quantidade, 0);

        const retiradasAposAjuste = movs
          .filter(m => m.tipo === 'retirada' && m.created_at > ultimoAjuste.created_at)
          .reduce((sum, m) => sum + m.quantidade, 0);

        estoque_esperado = ultimoAjuste.quantidade + entradasAposAjuste - retiradasAposAjuste;
      } else {
        // Sem ajuste: calcular desde o início
        const totalEntradas = movs
          .filter(m => m.tipo === 'entrada')
          .reduce((sum, m) => sum + m.quantidade, 0);

        const totalRetiradas = movs
          .filter(m => m.tipo === 'retirada')
          .reduce((sum, m) => sum + m.quantidade, 0);

        estoque_esperado = totalEntradas - totalRetiradas;
      }

      const diferenca = estoque_registrado - estoque_esperado;

      if (diferenca !== 0) {
        resultado.push({
          insumo_id: insumo.id,
          codigo: insumo.codigo_insumo,
          nome: insumo.nome_insumo,
          estoque_registrado,
          estoque_esperado,
          diferenca,
          ultimo_ajuste_data: dataUltimoAjuste,
        });
      }
    }

    return resultado;
  }, [insumos, todasMovimentacoes, estoque, loadingMov, loadingEstoque]);

  // Mutation para criar ajuste de correção
  const corrigirMutation = useMutation({
    mutationFn: async (item: Inconsistencia) => {
      if (!unidadeAtual) throw new Error('Nenhuma unidade selecionada');
      
      // Criar movimentação de ajuste com o valor registrado no estoque
      const { error } = await supabase.from('movimentacoes_estoque').insert({
        insumo_id: item.insumo_id,
        tipo: 'ajuste',
        quantidade: item.estoque_registrado,
        responsavel: userName || 'Sistema',
        observacao: `Ajuste de sincronização: diferença de ${item.diferenca} unidades corrigida`,
        unidade_id: unidadeAtual.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes_todas'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes_estoque'] });
      toast({ title: 'Ajuste de correção registrado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao corrigir', description: error.message, variant: 'destructive' });
    },
  });

  const isLoading = loadingMov || loadingInsumos || loadingEstoque;
  const totalVerificados = insumos.length;
  const totalInconsistentes = inconsistencias.length;
  const sincronizado = totalInconsistentes === 0 && !isLoading && totalVerificados > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Verificar Sincronização
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Verificação de Sincronização
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Itens Verificados</p>
                  <p className="text-2xl font-bold">{totalVerificados}</p>
                </div>
              </CardContent>
            </Card>
            <Card className={totalInconsistentes > 0 ? 'border-destructive' : 'border-green-500'}>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Inconsistências</p>
                  <p className={`text-2xl font-bold ${totalInconsistentes > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {isLoading ? '...' : totalInconsistentes}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className={sincronizado ? 'border-green-500' : ''}>
              <CardContent className="pt-4">
                <div className="text-center flex flex-col items-center">
                  <p className="text-sm text-muted-foreground">Status</p>
                  {isLoading ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : sincronizado ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">OK</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold">Divergente</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Inconsistências */}
          {totalInconsistentes > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Itens com Divergência
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Registrado</TableHead>
                      <TableHead className="text-right">Esperado</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      {isAdmin && <TableHead className="text-center">Ação</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inconsistencias.map((item) => (
                      <TableRow key={item.insumo_id}>
                        <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                        <TableCell className="font-medium">{item.nome}</TableCell>
                        <TableCell className="text-right">{item.estoque_registrado}</TableCell>
                        <TableCell className="text-right">{item.estoque_esperado}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.diferenca > 0 ? 'default' : 'destructive'}>
                            {item.diferenca > 0 ? '+' : ''}{item.diferenca}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => corrigirMutation.mutate(item)}
                              disabled={corrigirMutation.isPending}
                              className="gap-1"
                            >
                              <Wrench className="h-3 w-3" />
                              Corrigir
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-3">
                  * A correção cria um ajuste para sincronizar o histórico com o estoque atual registrado.
                </p>
              </CardContent>
            </Card>
          )}

          {sincronizado && (
            <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-3 text-green-600">
                  <CheckCircle className="h-8 w-8" />
                  <div>
                    <p className="font-semibold text-lg">Tudo Sincronizado!</p>
                    <p className="text-sm text-muted-foreground">
                      O estoque registrado confere com o histórico de movimentações.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
