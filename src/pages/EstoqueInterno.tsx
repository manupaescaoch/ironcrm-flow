import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, AlertTriangle, AlertCircle, Clock, Plus, Minus, Settings, PackagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORIAS = ['Limpeza', 'Café', 'Suplementação Interna', 'Operacional', 'Administrativo'] as const;
const UNIDADES = ['un', 'litro', 'kg', 'pacote', 'caixa'] as const;
const SETORES = ['Limpeza', 'Café', 'Treino', 'Administrativo'] as const;

type Insumo = {
  id: string;
  codigo_insumo: string;
  nome_insumo: string;
  categoria: string;
  unidade_medida: string;
  quantidade_minima: number;
  ativo: boolean;
};

type EstoqueInterno = {
  id: string;
  insumo_id: string;
  quantidade_atual: number;
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

type InsumoComEstoque = Insumo & {
  quantidade_atual: number;
  status_estoque: 'OK' | 'Atenção' | 'Crítico';
  media_diaria: number;
  media_semanal: number;
  media_mensal: number;
  dias_restantes: number | null;
  ultima_retirada: string | null;
  responsavel_ultima_retirada: string | null;
};

export default function EstoqueInterno() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  const [novoInsumoOpen, setNovoInsumoOpen] = useState(false);
  const [movimentacaoOpen, setMovimentacaoOpen] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'entrada' | 'retirada' | 'ajuste'>('entrada');
  
  // Form states
  const [novoInsumo, setNovoInsumo] = useState({
    codigo_insumo: '',
    nome_insumo: '',
    categoria: '',
    unidade_medida: '',
    quantidade_minima: 0,
  });
  
  const [movimentacao, setMovimentacao] = useState({
    quantidade: 0,
    setor: '',
    responsavel: '',
    observacao: '',
  });

  // Fetch insumos
  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .eq('ativo', true)
        .order('nome_insumo');
      if (error) throw error;
      return data as Insumo[];
    },
  });

  // Fetch estoque
  const { data: estoque = [] } = useQuery({
    queryKey: ['estoque_interno'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_interno')
        .select('*');
      if (error) throw error;
      return data as EstoqueInterno[];
    },
  });

  // Fetch movimentações últimos 30 dias
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes_estoque'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Movimentacao[];
    },
  });

  // Calcular dados consolidados
  const insumosComEstoque: InsumoComEstoque[] = insumos.map(insumo => {
    const estoqueItem = estoque.find(e => e.insumo_id === insumo.id);
    const quantidade_atual = estoqueItem?.quantidade_atual || 0;
    
    // Status
    let status_estoque: 'OK' | 'Atenção' | 'Crítico' = 'OK';
    if (quantidade_atual < insumo.quantidade_minima) status_estoque = 'Crítico';
    else if (quantidade_atual === insumo.quantidade_minima) status_estoque = 'Atenção';
    
    // Médias de consumo (apenas retiradas)
    const retiradas = movimentacoes.filter(m => m.insumo_id === insumo.id && m.tipo === 'retirada');
    const totalRetirado = retiradas.reduce((sum, m) => sum + m.quantidade, 0);
    const diasComOperacao = new Set(retiradas.map(m => m.created_at.split('T')[0])).size || 1;
    
    const media_diaria = totalRetirado / Math.max(diasComOperacao, 1);
    const media_semanal = media_diaria * 7;
    const media_mensal = media_diaria * 30;
    const dias_restantes = media_diaria > 0 ? Math.floor(quantidade_atual / media_diaria) : null;
    
    // Última retirada
    const ultimaRetirada = retiradas[0];
    
    return {
      ...insumo,
      quantidade_atual,
      status_estoque,
      media_diaria: Math.round(media_diaria * 10) / 10,
      media_semanal: Math.round(media_semanal * 10) / 10,
      media_mensal: Math.round(media_mensal * 10) / 10,
      dias_restantes,
      ultima_retirada: ultimaRetirada?.created_at || null,
      responsavel_ultima_retirada: ultimaRetirada?.responsavel || null,
    };
  });

  // KPIs
  const totalInsumos = insumos.length;
  const insumosAlerta = insumosComEstoque.filter(i => i.status_estoque === 'Atenção').length;
  const insumosCriticos = insumosComEstoque.filter(i => i.status_estoque === 'Crítico').length;
  const ultimaMovimentacao = movimentacoes[0];

  // Mutations
  const criarInsumoMutation = useMutation({
    mutationFn: async (data: typeof novoInsumo) => {
      const { error } = await supabase.from('insumos').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      setNovoInsumoOpen(false);
      setNovoInsumo({ codigo_insumo: '', nome_insumo: '', categoria: '', unidade_medida: '', quantidade_minima: 0 });
      toast({ title: 'Insumo cadastrado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar insumo', description: error.message, variant: 'destructive' });
    },
  });

  const registrarMovimentacaoMutation = useMutation({
    mutationFn: async (data: { insumo_id: string; tipo: string; quantidade: number; setor: string | null; responsavel: string; observacao: string | null }) => {
      const { error } = await supabase.from('movimentacoes_estoque').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque_interno'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes_estoque'] });
      setMovimentacaoOpen(false);
      setMovimentacao({ quantidade: 0, setor: '', responsavel: '', observacao: '' });
      setSelectedInsumo(null);
      toast({ title: 'Movimentação registrada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar movimentação', description: error.message, variant: 'destructive' });
    },
  });

  const handleCriarInsumo = () => {
    if (!novoInsumo.codigo_insumo || !novoInsumo.nome_insumo || !novoInsumo.categoria || !novoInsumo.unidade_medida) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    criarInsumoMutation.mutate(novoInsumo);
  };

  const handleRegistrarMovimentacao = () => {
    if (!selectedInsumo || !movimentacao.quantidade || !movimentacao.responsavel) {
      toast({ title: 'Preencha quantidade e responsável', variant: 'destructive' });
      return;
    }
    if (tipoMovimentacao === 'retirada' && !movimentacao.setor) {
      toast({ title: 'Selecione o setor para retirada', variant: 'destructive' });
      return;
    }
    registrarMovimentacaoMutation.mutate({
      insumo_id: selectedInsumo.id,
      tipo: tipoMovimentacao,
      quantidade: movimentacao.quantidade,
      setor: tipoMovimentacao === 'retirada' ? movimentacao.setor : null,
      responsavel: movimentacao.responsavel,
      observacao: movimentacao.observacao || null,
    });
  };

  const openMovimentacao = (insumo: Insumo, tipo: 'entrada' | 'retirada' | 'ajuste') => {
    setSelectedInsumo(insumo);
    setTipoMovimentacao(tipo);
    setMovimentacao({ quantidade: 0, setor: '', responsavel: '', observacao: '' });
    setMovimentacaoOpen(true);
  };

  const getStatusBadge = (status: string, diasRestantes: number | null) => {
    if (status === 'Crítico' || (diasRestantes !== null && diasRestantes < 5)) {
      return <Badge variant="destructive">Crítico</Badge>;
    }
    if (status === 'Atenção' || (diasRestantes !== null && diasRestantes < 10)) {
      return <Badge className="bg-yellow-500">Atenção</Badge>;
    }
    return <Badge className="bg-green-500">OK</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Estoque Interno - Insumos</h1>
            <p className="text-muted-foreground">Iron Club Zona Norte</p>
          </div>
          {isAdmin && (
            <Dialog open={novoInsumoOpen} onOpenChange={setNovoInsumoOpen}>
              <DialogTrigger asChild>
                <Button><PackagePlus className="w-4 h-4 mr-2" />Novo Insumo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Insumo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Código *</Label>
                      <Input 
                        value={novoInsumo.codigo_insumo} 
                        onChange={e => setNovoInsumo(p => ({ ...p, codigo_insumo: e.target.value }))}
                        placeholder="Ex: LIM001"
                      />
                    </div>
                    <div>
                      <Label>Nome *</Label>
                      <Input 
                        value={novoInsumo.nome_insumo} 
                        onChange={e => setNovoInsumo(p => ({ ...p, nome_insumo: e.target.value }))}
                        placeholder="Ex: Desinfetante"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Categoria *</Label>
                      <Select value={novoInsumo.categoria} onValueChange={v => setNovoInsumo(p => ({ ...p, categoria: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Unidade *</Label>
                      <Select value={novoInsumo.unidade_medida} onValueChange={v => setNovoInsumo(p => ({ ...p, unidade_medida: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Quantidade Mínima</Label>
                    <Input 
                      type="number" 
                      value={novoInsumo.quantidade_minima} 
                      onChange={e => setNovoInsumo(p => ({ ...p, quantidade_minima: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <Button onClick={handleCriarInsumo} className="w-full" disabled={criarInsumoMutation.isPending}>
                    {criarInsumoMutation.isPending ? 'Salvando...' : 'Cadastrar Insumo'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Insumos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalInsumos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Alerta</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{insumosAlerta}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Críticos</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{insumosCriticos}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Última Movimentação</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {ultimaMovimentacao 
                  ? format(new Date(ultimaMovimentacao.created_at), "dd/MM HH:mm", { locale: ptBR })
                  : 'Nenhuma'}
              </div>
              {ultimaMovimentacao && (
                <p className="text-xs text-muted-foreground">{ultimaMovimentacao.responsavel}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela Principal */}
        <Card>
          <CardHeader>
            <CardTitle>Controle de Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Atual</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Méd. Diária</TableHead>
                    <TableHead className="text-right">Méd. Semanal</TableHead>
                    <TableHead className="text-right">Méd. Mensal</TableHead>
                    <TableHead className="text-right">Dias Restantes</TableHead>
                    <TableHead>Última Retirada</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insumosComEstoque.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        Nenhum insumo cadastrado. {isAdmin && 'Clique em "Novo Insumo" para começar.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    insumosComEstoque.map(item => (
                      <TableRow key={item.id} className={item.status_estoque === 'Crítico' ? 'bg-destructive/10' : item.status_estoque === 'Atenção' ? 'bg-yellow-500/10' : ''}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{item.nome_insumo}</span>
                            <p className="text-xs text-muted-foreground">{item.codigo_insumo}</p>
                          </div>
                        </TableCell>
                        <TableCell>{item.categoria}</TableCell>
                        <TableCell>{item.unidade_medida}</TableCell>
                        <TableCell className="text-right font-medium">{item.quantidade_atual}</TableCell>
                        <TableCell className="text-right">{item.quantidade_minima}</TableCell>
                        <TableCell>{getStatusBadge(item.status_estoque, item.dias_restantes)}</TableCell>
                        <TableCell className="text-right">{item.media_diaria}</TableCell>
                        <TableCell className="text-right">{item.media_semanal}</TableCell>
                        <TableCell className="text-right">{item.media_mensal}</TableCell>
                        <TableCell className="text-right">
                          {item.dias_restantes !== null ? (
                            <span className={item.dias_restantes < 5 ? 'text-destructive font-bold' : item.dias_restantes < 10 ? 'text-yellow-600 font-medium' : ''}>
                              {item.dias_restantes} dias
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {item.ultima_retirada ? (
                            <div>
                              <span className="text-sm">{format(new Date(item.ultima_retirada), "dd/MM", { locale: ptBR })}</span>
                              <p className="text-xs text-muted-foreground">{item.responsavel_ultima_retirada}</p>
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="outline" onClick={() => openMovimentacao(item, 'entrada')} title="Entrada">
                              <Plus className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="outline" onClick={() => openMovimentacao(item, 'retirada')} title="Retirada">
                              <Minus className="h-4 w-4 text-destructive" />
                            </Button>
                            {isAdmin && (
                              <Button size="icon" variant="outline" onClick={() => openMovimentacao(item, 'ajuste')} title="Ajuste">
                                <Settings className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Modal Movimentação */}
        <Dialog open={movimentacaoOpen} onOpenChange={setMovimentacaoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {tipoMovimentacao === 'entrada' && '➕ Registrar Entrada'}
                {tipoMovimentacao === 'retirada' && '➖ Registrar Retirada'}
                {tipoMovimentacao === 'ajuste' && '⚠️ Ajuste de Estoque'}
              </DialogTitle>
            </DialogHeader>
            {selectedInsumo && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedInsumo.nome_insumo}</p>
                  <p className="text-sm text-muted-foreground">{selectedInsumo.codigo_insumo} • {selectedInsumo.unidade_medida}</p>
                </div>
                <div>
                  <Label>{tipoMovimentacao === 'ajuste' ? 'Nova Quantidade *' : 'Quantidade *'}</Label>
                  <Input 
                    type="number" 
                    value={movimentacao.quantidade || ''} 
                    onChange={e => setMovimentacao(p => ({ ...p, quantidade: parseInt(e.target.value) || 0 }))}
                    min={0}
                  />
                </div>
                {tipoMovimentacao === 'retirada' && (
                  <div>
                    <Label>Setor *</Label>
                    <Select value={movimentacao.setor} onValueChange={v => setMovimentacao(p => ({ ...p, setor: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                      <SelectContent>
                        {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Responsável *</Label>
                  <Input 
                    value={movimentacao.responsavel} 
                    onChange={e => setMovimentacao(p => ({ ...p, responsavel: e.target.value }))}
                    placeholder="Nome do responsável"
                  />
                </div>
                <div>
                  <Label>Observação</Label>
                  <Textarea 
                    value={movimentacao.observacao} 
                    onChange={e => setMovimentacao(p => ({ ...p, observacao: e.target.value }))}
                    placeholder="Observações (opcional)"
                  />
                </div>
                <Button onClick={handleRegistrarMovimentacao} className="w-full" disabled={registrarMovimentacaoMutation.isPending}>
                  {registrarMovimentacaoMutation.isPending ? 'Registrando...' : 'Confirmar'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
