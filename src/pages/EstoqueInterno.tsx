import { useState, useMemo, useEffect, useRef } from 'react';
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
import { Package, AlertTriangle, AlertCircle, Clock, Plus, Minus, Settings, PackagePlus, Pencil, Search, X, Trash2, TrendingUp, TrendingDown, Skull, Info, ShoppingCart, DollarSign, BarChart3, FileText, Calendar, Gift } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HistoricoMovimentacoes } from '@/components/estoque/HistoricoMovimentacoes';
import { EstoqueNavigation } from '@/components/estoque/EstoqueNavigation';
import { useUnidade } from '@/contexts/UnidadeContext';

const CATEGORIAS = ['Copa e Recepção', 'Suplementos (uso interno)', 'Limpeza', 'Descartáveis', 'Higiene Pessoal'] as const;
const UNIDADES = ['un', 'pacote', 'litro', 'kg', 'caixa'] as const;
const SETORES = ['Limpeza', 'Café', 'Treino', 'Administrativo', 'Recepção'] as const;
const STATUS_OPTIONS = ['Todos', 'Sem Estoque', 'Crítico', 'Atenção', 'Normal'] as const;

type StatusEstoque = 'Normal' | 'Atenção' | 'Crítico' | 'Sem Estoque';

type Insumo = {
  id: string;
  codigo_insumo: string;
  nome_insumo: string;
  categoria: string;
  unidade_medida: string;
  quantidade_minima: number;
  lead_time_dias: number;
  estoque_seguranca_dias: number;
  custo_unitario: number;
  fornecedor_padrao: string | null;
  quantidade_minima_compra: number;
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
  valor_unitario: number | null;
  valor_total: number | null;
  fornecedor: string | null;
  nota_fiscal: string | null;
};

type InsumoComEstoque = Insumo & {
  quantidade_atual: number;
  status_estoque: StatusEstoque;
  media_diaria: number;
  media_semanal: number;
  media_mensal: number;
  dias_restantes: number | null;
  ponto_pedido: number;
  data_ruptura: Date | null;
  data_limite_pedido: Date | null;
  ultima_retirada: string | null;
  responsavel_ultima_retirada: string | null;
  // Campos financeiros calculados
  valor_estoque_atual: number;
  valor_ponto_pedido: number;
  valor_reposicao: number;
  // Duração média por unidade (em dias)
  duracao_media_por_unidade: number | null;
  retiradas_count: number;
};

// Função para calcular status preditivo
function calcularStatusPreditivo(
  quantidadeAtual: number,
  pontoPedido: number,
  dataLimitePedido: Date | null,
  dataRuptura: Date | null
): StatusEstoque {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // ☠️ Sem Estoque: estoque = 0 ou data atual > data de ruptura
  if (quantidadeAtual === 0) return 'Sem Estoque';
  if (dataRuptura && hoje > dataRuptura) return 'Sem Estoque';

  // 🔴 Crítico: data atual >= data limite de pedido
  if (dataLimitePedido && hoje >= dataLimitePedido) return 'Crítico';

  // 🟡 Atenção: estoque atual <= ponto de pedido
  if (quantidadeAtual <= pontoPedido) return 'Atenção';

  // 🟢 Normal: estoque atual > ponto de pedido
  return 'Normal';
}

export default function EstoqueInterno() {
  const { toast } = useToast();
  const { isAdmin, userName, user } = useAuth();
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();
  
  const [novoInsumoOpen, setNovoInsumoOpen] = useState(false);
  const [editarInsumoOpen, setEditarInsumoOpen] = useState(false);
  const [movimentacaoOpen, setMovimentacaoOpen] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'entrada' | 'retirada' | 'ajuste'>('entrada');
  
  // Filtros e busca
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  
  // Form states
  const [novoInsumo, setNovoInsumo] = useState({
    codigo_insumo: '',
    nome_insumo: '',
    categoria: '',
    unidade_medida: '',
    quantidade_minima: 0,
    lead_time_dias: 3,
    estoque_seguranca_dias: 2,
    custo_unitario: 0,
    fornecedor_padrao: '',
    quantidade_minima_compra: 1,
  });
  
  const [editInsumo, setEditInsumo] = useState({
    id: '',
    codigo_insumo: '',
    nome_insumo: '',
    categoria: '',
    unidade_medida: '',
    quantidade_minima: 0,
    lead_time_dias: 3,
    estoque_seguranca_dias: 2,
    custo_unitario: 0,
    fornecedor_padrao: '',
    quantidade_minima_compra: 1,
  });
  
  const [movimentacao, setMovimentacao] = useState({
    quantidade: 0,
    setor: '',
    responsavel: '',
    observacao: '',
    valor_unitario: 0,
    fornecedor: '',
    nota_fiscal: '',
    is_patrocinio: false,
  });

  // Fetch insumos
  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .eq('ativo', true)
        .eq('unidade_id', unidadeAtual.id)
        .order('nome_insumo');
      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!unidadeAtual,
  });

  // Fetch estoque
  const { data: estoque = [] } = useQuery({
    queryKey: ['estoque_interno', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const { data, error } = await supabase
        .from('estoque_interno')
        .select('*')
        .eq('unidade_id', unidadeAtual.id);
      if (error) throw error;
      return data as EstoqueInterno[];
    },
    enabled: !!unidadeAtual,
  });

  // Fetch movimentações últimos 30 dias
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes_estoque', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual) return [];
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('unidade_id', unidadeAtual.id)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: !!unidadeAtual,
  });

  // Calcular dados consolidados com lógica preditiva
  const insumosComEstoque: InsumoComEstoque[] = insumos.map(insumo => {
    const estoqueItem = estoque.find(e => e.insumo_id === insumo.id);
    const quantidade_atual = estoqueItem?.quantidade_atual || 0;
    
    // Médias de consumo (apenas retiradas)
    const retiradas = movimentacoes.filter(m => m.insumo_id === insumo.id && m.tipo === 'retirada');
    const totalRetirado = retiradas.reduce((sum, m) => sum + m.quantidade, 0);
    const diasComOperacao = new Set(retiradas.map(m => m.created_at.split('T')[0])).size || 1;
    
    // Cálculo da DURAÇÃO MÉDIA por unidade
    // Fórmula: (Data última retirada - Data primeira retirada) / Total unidades consumidas
    let duracao_media_por_unidade: number | null = null;
    const retiradas_count = retiradas.length;
    
    if (retiradas.length >= 2 && totalRetirado > 0) {
      // Ordenar retiradas por data (mais antiga primeiro)
      const retiradasOrdenadas = [...retiradas].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const primeiraRetirada = new Date(retiradasOrdenadas[0].created_at);
      const ultimaRetiradaData = new Date(retiradasOrdenadas[retiradasOrdenadas.length - 1].created_at);
      const periodoEmDias = Math.max(1, Math.ceil((ultimaRetiradaData.getTime() - primeiraRetirada.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Duração média = período total / unidades consumidas
      duracao_media_por_unidade = Math.round((periodoEmDias / totalRetirado) * 10) / 10;
    }
    
    // Usar duração média se disponível, senão calcular pelo método antigo
    let media_diaria: number;
    if (duracao_media_por_unidade && duracao_media_por_unidade > 0) {
      // Inverso da duração média: se 1 unidade dura 5 dias, consumo = 0.2/dia
      media_diaria = 1 / duracao_media_por_unidade;
    } else {
      media_diaria = totalRetirado / Math.max(diasComOperacao, 1);
    }
    
    const media_semanal = media_diaria * 7;
    const media_mensal = media_diaria * 30;
    const dias_restantes = media_diaria > 0 ? Math.floor(quantidade_atual / media_diaria) : null;
    
    // Cálculos preditivos
    const leadTime = insumo.lead_time_dias || 3;
    const estoqueSeguranca = insumo.estoque_seguranca_dias || 2;
    
    // Ponto de Pedido = (Lead Time + Estoque de Segurança) × Consumo Médio Diário
    const ponto_pedido = Math.ceil((leadTime + estoqueSeguranca) * media_diaria);
    
    // Data de Ruptura = Data Atual + Dias Restantes
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const data_ruptura = dias_restantes !== null ? addDays(hoje, dias_restantes) : null;
    
    // Data Limite de Pedido = Data de Ruptura – Lead Time
    const data_limite_pedido = data_ruptura ? addDays(data_ruptura, -leadTime) : null;
    
    // Status preditivo
    const status_estoque = calcularStatusPreditivo(quantidade_atual, ponto_pedido, data_limite_pedido, data_ruptura);
    
    // Última retirada
    const ultimaRetirada = retiradas[0];
    
    // Cálculos financeiros
    const custo = insumo.custo_unitario || 0;
    const qtdMinimaCompra = insumo.quantidade_minima_compra || 1;
    const valor_estoque_atual = quantidade_atual * custo;
    const valor_ponto_pedido = ponto_pedido * custo;
    const valor_reposicao = qtdMinimaCompra * custo;
    
    return {
      ...insumo,
      quantidade_atual,
      status_estoque,
      media_diaria: Math.round(media_diaria * 10) / 10,
      media_semanal: Math.round(media_semanal * 10) / 10,
      media_mensal: Math.round(media_mensal * 10) / 10,
      dias_restantes,
      ponto_pedido,
      data_ruptura,
      data_limite_pedido,
      ultima_retirada: ultimaRetirada?.created_at || null,
      responsavel_ultima_retirada: ultimaRetirada?.responsavel || null,
      valor_estoque_atual,
      valor_ponto_pedido,
      valor_reposicao,
      duracao_media_por_unidade,
      retiradas_count,
    };
  });

  // Filtragem e ordenação automática por prioridade
  const insumosFiltradosOrdenados = useMemo(() => {
    let resultado = [...insumosComEstoque];
    
    // Aplicar busca
    if (busca.trim()) {
      const termoBusca = busca.toLowerCase().trim();
      resultado = resultado.filter(item =>
        item.nome_insumo.toLowerCase().includes(termoBusca) ||
        item.codigo_insumo.toLowerCase().includes(termoBusca) ||
        item.categoria.toLowerCase().includes(termoBusca) ||
        item.unidade_medida.toLowerCase().includes(termoBusca)
      );
    }
    
    // Aplicar filtro de categoria
    if (filtroCategoria !== 'Todas') {
      resultado = resultado.filter(item => item.categoria === filtroCategoria);
    }
    
    // Aplicar filtro de status
    if (filtroStatus !== 'Todos') {
      resultado = resultado.filter(item => item.status_estoque === filtroStatus);
    }
    
    // Ordenação inteligente: Sem Estoque > Crítico > Atenção > Normal, depois por dias restantes
    const statusPrioridade: Record<StatusEstoque, number> = { 'Sem Estoque': 0, 'Crítico': 1, 'Atenção': 2, 'Normal': 3 };
    resultado.sort((a, b) => {
      // Primeiro por status
      const statusDiff = statusPrioridade[a.status_estoque] - statusPrioridade[b.status_estoque];
      if (statusDiff !== 0) return statusDiff;
      
      // Depois por dias restantes (null = infinito, vai pro final)
      const diasA = a.dias_restantes ?? 999999;
      const diasB = b.dias_restantes ?? 999999;
      return diasA - diasB;
    });
    
    return resultado;
  }, [insumosComEstoque, busca, filtroCategoria, filtroStatus]);

  // KPIs (baseados nos dados totais, não filtrados)
  const totalInsumos = insumos.length;
  const insumosRuptura = insumosComEstoque.filter(i => i.status_estoque === 'Sem Estoque').length;
  const insumosCriticos = insumosComEstoque.filter(i => i.status_estoque === 'Crítico').length;
  const insumosAtencao = insumosComEstoque.filter(i => i.status_estoque === 'Atenção').length;
  const ultimaMovimentacao = movimentacoes[0];
  
  // Controle para evitar notificações repetidas
  const notificadosRef = useRef<Map<string, StatusEstoque>>(new Map());
  
  // Alertas automáticos inteligentes
  useEffect(() => {
    insumosComEstoque.forEach(insumo => {
      const statusAnterior = notificadosRef.current.get(insumo.id);
      const statusAtual = insumo.status_estoque;
      
      // Só notifica se mudou para um status mais grave ou é primeira vez
      if (statusAtual !== 'Normal' && statusAnterior !== statusAtual) {
        const dataLimiteFormatada = insumo.data_limite_pedido 
          ? format(insumo.data_limite_pedido, 'dd/MM/yyyy', { locale: ptBR })
          : 'N/A';
        const valorReposicao = insumo.valor_reposicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const fornecedor = insumo.fornecedor_padrao || 'Não definido';
        
        if (statusAtual === 'Sem Estoque') {
          toast({
            title: '☠️ SEM ESTOQUE',
            description: `${insumo.nome_insumo} está sem estoque! Reposição: ${valorReposicao}. Fornecedor: ${fornecedor}.`,
            variant: 'destructive',
            duration: 10000,
          });
        } else if (statusAtual === 'Crítico') {
          toast({
            title: '🔴 Estoque Crítico',
            description: `${insumo.nome_insumo}: ${insumo.dias_restantes ?? 0} dias. Reposição: ${valorReposicao}. Fornecedor: ${fornecedor}. Pedir até ${dataLimiteFormatada}.`,
            variant: 'destructive',
            duration: 8000,
          });
        } else if (statusAtual === 'Atenção') {
          toast({
            title: '🟡 Atenção - Hora de Pedir',
            description: `${insumo.nome_insumo}: Reposição: ${valorReposicao}. Fornecedor: ${fornecedor}. Data limite: ${dataLimiteFormatada}.`,
            duration: 6000,
          });
        }
        
        notificadosRef.current.set(insumo.id, statusAtual);
      }
      
      // Se voltou ao normal, limpa o registro
      if (statusAtual === 'Normal') {
        notificadosRef.current.delete(insumo.id);
      }
    });
  }, [insumosComEstoque, toast]);
  
  const limparFiltros = () => {
    setBusca('');
    setFiltroCategoria('Todas');
    setFiltroStatus('Todos');
  };
  
  const temFiltrosAtivos = busca.trim() || filtroCategoria !== 'Todas' || filtroStatus !== 'Todos';

  // Mutations
  const criarInsumoMutation = useMutation({
    mutationFn: async (data: typeof novoInsumo) => {
      if (!unidadeAtual) throw new Error('Nenhuma unidade selecionada');
      const { error } = await supabase.from('insumos').insert({
        ...data,
        codigo_insumo: data.codigo_insumo.toUpperCase(),
        nome_insumo: data.nome_insumo.toUpperCase(),
        unidade_id: unidadeAtual.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos', unidadeAtual?.id] });
      setNovoInsumoOpen(false);
      setNovoInsumo({ codigo_insumo: '', nome_insumo: '', categoria: '', unidade_medida: '', quantidade_minima: 0, lead_time_dias: 3, estoque_seguranca_dias: 2, custo_unitario: 0, fornecedor_padrao: '', quantidade_minima_compra: 1 });
      toast({ title: 'Insumo cadastrado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao cadastrar insumo', description: error.message, variant: 'destructive' });
    },
  });

  const editarInsumoMutation = useMutation({
    mutationFn: async (data: typeof editInsumo) => {
      const { error } = await supabase.from('insumos').update({
        codigo_insumo: data.codigo_insumo.toUpperCase(),
        nome_insumo: data.nome_insumo.toUpperCase(),
        categoria: data.categoria,
        unidade_medida: data.unidade_medida,
        quantidade_minima: data.quantidade_minima,
        lead_time_dias: data.lead_time_dias,
        estoque_seguranca_dias: data.estoque_seguranca_dias,
        custo_unitario: data.custo_unitario,
        fornecedor_padrao: data.fornecedor_padrao || null,
        quantidade_minima_compra: data.quantidade_minima_compra,
      }).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos', unidadeAtual?.id] });
      setEditarInsumoOpen(false);
      toast({ title: 'Insumo atualizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar insumo', description: error.message, variant: 'destructive' });
    },
  });

  const registrarMovimentacaoMutation = useMutation({
    mutationFn: async (data: { 
      insumo_id: string; 
      tipo: string; 
      quantidade: number; 
      setor: string | null; 
      responsavel: string; 
      observacao: string | null;
      valor_unitario: number | null;
      valor_total: number | null;
      fornecedor: string | null;
      nota_fiscal: string | null;
    }) => {
      if (!unidadeAtual) throw new Error('Nenhuma unidade selecionada');
      const { error } = await supabase.from('movimentacoes_estoque').insert({
        ...data,
        unidade_id: unidadeAtual.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque_interno', unidadeAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes_estoque', unidadeAtual?.id] });
      setMovimentacaoOpen(false);
      setMovimentacao({ quantidade: 0, setor: '', responsavel: '', observacao: '', valor_unitario: 0, fornecedor: '', nota_fiscal: '', is_patrocinio: false });
      setSelectedInsumo(null);
      toast({ title: 'Movimentação registrada!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar movimentação', description: error.message, variant: 'destructive' });
    },
  });

  const excluirInsumoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('insumos').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos', unidadeAtual?.id] });
      toast({ title: 'Insumo excluído com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir insumo', description: error.message, variant: 'destructive' });
    },
  });

  const handleCriarInsumo = () => {
    if (!novoInsumo.codigo_insumo || !novoInsumo.nome_insumo || !novoInsumo.categoria || !novoInsumo.unidade_medida) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    criarInsumoMutation.mutate(novoInsumo);
  };

  const handleEditarInsumo = () => {
    if (!editInsumo.codigo_insumo || !editInsumo.nome_insumo || !editInsumo.categoria || !editInsumo.unidade_medida) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    editarInsumoMutation.mutate(editInsumo);
  };

  const openEditarInsumo = (insumo: Insumo) => {
    setEditInsumo({
      id: insumo.id,
      codigo_insumo: insumo.codigo_insumo,
      nome_insumo: insumo.nome_insumo,
      categoria: insumo.categoria,
      unidade_medida: insumo.unidade_medida,
      quantidade_minima: insumo.quantidade_minima,
      lead_time_dias: insumo.lead_time_dias || 3,
      estoque_seguranca_dias: insumo.estoque_seguranca_dias || 2,
      custo_unitario: insumo.custo_unitario || 0,
      fornecedor_padrao: insumo.fornecedor_padrao || '',
      quantidade_minima_compra: insumo.quantidade_minima_compra || 1,
    });
    setEditarInsumoOpen(true);
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
    // Aceitar valor 0 para patrocínios, ou valor > 0 para compras normais
    const valorUnitario = tipoMovimentacao === 'entrada' && (movimentacao.valor_unitario >= 0 || movimentacao.is_patrocinio)
      ? movimentacao.valor_unitario 
      : null;
    const valorTotal = tipoMovimentacao === 'entrada' && valorUnitario !== null
      ? valorUnitario * movimentacao.quantidade 
      : null;
    
    // Verificar variação de preço > 20% e alertar
    if (tipoMovimentacao === 'entrada' && valorUnitario) {
      const entradasInsumo = movimentacoes.filter(
        m => m.insumo_id === selectedInsumo.id && m.tipo === 'entrada' && m.valor_unitario
      );
      if (entradasInsumo.length > 0) {
        const mediaValorUnitario = entradasInsumo.reduce((sum, e) => sum + (e.valor_unitario || 0), 0) / entradasInsumo.length;
        const variacaoPreco = ((valorUnitario - mediaValorUnitario) / mediaValorUnitario) * 100;
        
        if (variacaoPreco > 20) {
          toast({
            title: '⚠️ Alerta de Preço Elevado',
            description: `O valor pago (${valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) está ${variacaoPreco.toFixed(1)}% acima da média histórica (${mediaValorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) para ${selectedInsumo.nome_insumo}.`,
            variant: 'destructive',
            duration: 8000,
          });
        }
      }
    }
    
    registrarMovimentacaoMutation.mutate({
      insumo_id: selectedInsumo.id,
      tipo: tipoMovimentacao,
      quantidade: movimentacao.quantidade,
      setor: tipoMovimentacao === 'retirada' ? movimentacao.setor : null,
      responsavel: movimentacao.responsavel,
      observacao: movimentacao.observacao || null,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
      fornecedor: tipoMovimentacao === 'entrada' && movimentacao.fornecedor ? movimentacao.fornecedor : null,
      nota_fiscal: tipoMovimentacao === 'entrada' && movimentacao.nota_fiscal ? movimentacao.nota_fiscal : null,
    });
  };

  const openMovimentacao = (insumo: Insumo, tipo: 'entrada' | 'retirada' | 'ajuste') => {
    setSelectedInsumo(insumo);
    setTipoMovimentacao(tipo);
    // Preencher responsável com nome do usuário logado (uppercase)
    const nomeResponsavel = userName ? userName.toUpperCase() : (user?.email?.split('@')[0]?.toUpperCase() || '');
    setMovimentacao({ 
      quantidade: 0, 
      setor: '', 
      responsavel: nomeResponsavel,
      observacao: '',
      valor_unitario: insumo.custo_unitario || 0,
      fornecedor: insumo.fornecedor_padrao || '',
      nota_fiscal: '',
      is_patrocinio: false,
    });
    setMovimentacaoOpen(true);
  };

  const getStatusBadge = (status: StatusEstoque) => {
    switch (status) {
      case 'Sem Estoque':
        return <Badge className="bg-black text-white animate-pulse gap-1"><Skull className="h-3 w-3" />Sem Estoque</Badge>;
      case 'Crítico':
        return <Badge className="bg-destructive text-destructive-foreground animate-pulse gap-1"><AlertCircle className="h-3 w-3" />Crítico</Badge>;
      case 'Atenção':
        return <Badge className="bg-warning text-warning-foreground gap-1"><AlertTriangle className="h-3 w-3" />Atenção</Badge>;
      default:
        return <Badge className="bg-success text-success-foreground gap-1"><Package className="h-3 w-3" />Normal</Badge>;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <Layout>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header com navegação otimizada */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Estoque Interno</h1>
                <p className="text-sm text-muted-foreground">{unidadeAtual?.nome || 'Selecione uma unidade'}</p>
              </div>
              <Button size="sm" onClick={() => setNovoInsumoOpen(true)}>
                <PackagePlus className="w-4 h-4 mr-2" />Novo Insumo
              </Button>
            </div>
            
            {/* Navegação compacta em tabs */}
            <EstoqueNavigation currentPage="insumos" />
          </div>
          
          {/* Modal Novo Insumo */}
          <Dialog open={novoInsumoOpen} onOpenChange={setNovoInsumoOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                      <PackagePlus className="h-5 w-5 text-primary" />
                      Cadastrar Novo Insumo
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5">
                    {/* Seção: Identificação */}
                    <div className="rounded-lg border bg-card p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Package className="h-4 w-4 text-primary" />
                        Identificação do Produto
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Código *</Label>
                          <Input 
                            value={novoInsumo.codigo_insumo} 
                            onChange={e => setNovoInsumo(p => ({ ...p, codigo_insumo: e.target.value.toUpperCase() }))}
                            placeholder="Ex: LIM001"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Nome *</Label>
                          <Input 
                            value={novoInsumo.nome_insumo} 
                            onChange={e => setNovoInsumo(p => ({ ...p, nome_insumo: e.target.value.toUpperCase() }))}
                            placeholder="Ex: DESINFETANTE"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Categoria *</Label>
                          <Select value={novoInsumo.categoria} onValueChange={v => setNovoInsumo(p => ({ ...p, categoria: v }))}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Unidade de Medida *</Label>
                          <Select value={novoInsumo.unidade_medida} onValueChange={v => setNovoInsumo(p => ({ ...p, unidade_medida: v }))}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Quantidade Mínima em Estoque</Label>
                        <Input 
                          type="number" 
                          value={novoInsumo.quantidade_minima} 
                          onChange={e => setNovoInsumo(p => ({ ...p, quantidade_minima: parseInt(e.target.value) || 0 }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    {/* Seção: Configurações de Reposição */}
                    <div className="rounded-lg border bg-card p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Clock className="h-4 w-4 text-amber-500" />
                        Configurações de Reposição
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-muted-foreground">Lead Time (dias)</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Tempo em dias que o fornecedor leva para entregar após o pedido.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Input 
                            type="number" 
                            min={1}
                            value={novoInsumo.lead_time_dias} 
                            onChange={e => setNovoInsumo(p => ({ ...p, lead_time_dias: parseInt(e.target.value) || 3 }))}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-muted-foreground">Estoque Segurança (dias)</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Margem de segurança para cobrir variações de demanda ou atrasos.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Input 
                            type="number" 
                            min={0}
                            value={novoInsumo.estoque_seguranca_dias} 
                            onChange={e => setNovoInsumo(p => ({ ...p, estoque_seguranca_dias: parseInt(e.target.value) || 2 }))}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Seção: Informações Financeiras - DESTAQUE */}
                    <div className="rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        <DollarSign className="h-4 w-4" />
                        Informações Financeiras
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-muted-foreground">Custo Unitário (R$)</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Custo por unidade para cálculo do valor do estoque.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                            <Input 
                              type="number" 
                              step="0.01"
                              min={0}
                              value={novoInsumo.custo_unitario} 
                              onChange={e => setNovoInsumo(p => ({ ...p, custo_unitario: parseFloat(e.target.value) || 0 }))}
                              placeholder="0,00"
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-muted-foreground">Qtd. Mínima de Compra</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Quantidade mínima exigida pelo fornecedor (lote, caixa).</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Input 
                            type="number" 
                            min={1}
                            value={novoInsumo.quantidade_minima_compra} 
                            onChange={e => setNovoInsumo(p => ({ ...p, quantidade_minima_compra: parseInt(e.target.value) || 1 }))}
                          />
                        </div>
                      </div>
                      
                      {/* Valor estimado de reposição */}
                      {novoInsumo.custo_unitario > 0 && novoInsumo.quantidade_minima_compra > 0 && (
                        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Valor estimado por pedido:</span>
                            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                              {(novoInsumo.custo_unitario * novoInsumo.quantidade_minima_compra).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Seção: Fornecedor */}
                    <div className="rounded-lg border bg-card p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <ShoppingCart className="h-4 w-4 text-blue-500" />
                        Fornecedor
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Fornecedor Padrão</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Nome do fornecedor principal para este item.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input 
                          value={novoInsumo.fornecedor_padrao} 
                          onChange={e => setNovoInsumo(p => ({ ...p, fornecedor_padrao: e.target.value }))}
                          placeholder="Ex: Distribuidora ABC"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    <Button onClick={handleCriarInsumo} className="w-full h-11 text-base font-medium" disabled={criarInsumoMutation.isPending}>
                      {criarInsumoMutation.isPending ? 'Salvando...' : 'Cadastrar Insumo'}
                    </Button>
                  </div>
                </DialogContent>
          </Dialog>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Insumos</CardTitle>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Package className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalInsumos}</div>
                <p className="text-xs text-muted-foreground mt-1">itens cadastrados</p>
              </CardContent>
            </Card>
            
            <Card className={`border-l-4 border-l-black bg-gradient-to-br from-gray-900/10 to-transparent ${insumosRuptura > 0 ? 'ring-2 ring-black/30' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sem Estoque</CardTitle>
                <div className={`p-2 bg-black/10 rounded-lg ${insumosRuptura > 0 ? 'animate-pulse' : ''}`}>
                  <Skull className="h-5 w-5 text-black" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{insumosRuptura}</div>
                <p className="text-xs text-muted-foreground mt-1">sem estoque</p>
              </CardContent>
            </Card>
            
            <Card className={`border-l-4 border-l-destructive bg-gradient-to-br from-destructive/5 to-transparent ${insumosCriticos > 0 ? 'ring-2 ring-destructive/30' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Críticos</CardTitle>
                <div className={`p-2 bg-destructive/10 rounded-lg ${insumosCriticos > 0 ? 'animate-pulse' : ''}`}>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{insumosCriticos}</div>
                <p className="text-xs text-muted-foreground mt-1">pedir agora!</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-warning bg-gradient-to-br from-warning/5 to-transparent">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Atenção</CardTitle>
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning">{insumosAtencao}</div>
                <p className="text-xs text-muted-foreground mt-1">abaixo ponto pedido</p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-muted-foreground">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Última Movimentação</CardTitle>
                <div className="p-2 bg-muted rounded-lg">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {ultimaMovimentacao 
                    ? format(new Date(ultimaMovimentacao.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                    : 'Nenhuma'}
                </div>
                {ultimaMovimentacao && (
                  <p className="text-xs text-muted-foreground mt-1">por {ultimaMovimentacao.responsavel}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Busca e Filtros */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Busca Global */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="🔎 Buscar insumo por nome, código ou categoria"
                    className="pl-9"
                  />
                </div>
                
                {/* Filtro Categoria */}
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                  <SelectTrigger className="w-full lg:w-[220px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todas">Todas as Categorias</SelectItem>
                    {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                
                {/* Filtro Status - Chips */}
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTIONS.map(status => (
                    <Button
                      key={status}
                      variant={filtroStatus === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFiltroStatus(status)}
                      className={
                        status === 'Sem Estoque' ? (filtroStatus === status ? 'bg-black hover:bg-black/90 text-white' : 'border-black/50 text-black hover:bg-black/10') :
                        status === 'Crítico' ? (filtroStatus === status ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'border-destructive/50 text-destructive hover:bg-destructive/10') :
                        status === 'Atenção' ? (filtroStatus === status ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : 'border-warning/50 text-warning hover:bg-warning/10') :
                        status === 'Normal' ? (filtroStatus === status ? 'bg-success hover:bg-success/90 text-success-foreground' : 'border-success/50 text-success hover:bg-success/10') :
                        ''
                      }
                    >
                      {status === 'Sem Estoque' && <Skull className="h-3 w-3 mr-1" />}
                      {status === 'Crítico' && <AlertCircle className="h-3 w-3 mr-1" />}
                      {status === 'Atenção' && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {status === 'Normal' && <Package className="h-3 w-3 mr-1" />}
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
              
              {temFiltrosAtivos && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {insumosFiltradosOrdenados.length} resultado(s)
                  </span>
                  <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1 h-7">
                    <X className="h-3 w-3" />
                    Limpar filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabela Principal */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <span>Controle de Estoque Preditivo</span>
                </div>
                <Badge variant="outline" className="font-normal">
                  Ordenado por criticidade
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="font-semibold">Insumo</TableHead>
                      <TableHead className="font-semibold text-center">Status</TableHead>
                      <TableHead className="font-semibold text-center">Atual</TableHead>
                      <TableHead className="font-semibold text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                            Pto. Pedido
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ponto de Pedido = (Lead Time + Estoque Segurança) × Consumo/Dia</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                            ⏱️ Duração/Un
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Tempo médio que 1 unidade dura, calculado com base no histórico real de retiradas.</p>
                            <p className="text-xs text-muted-foreground mt-1">Requer mínimo de 2 retiradas para calcular.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="font-semibold text-center bg-primary/10 text-primary">⏳ Dias Rest.</TableHead>
                      <TableHead className="font-semibold text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                            📅 Ruptura
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Data estimada em que o estoque acabará</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                            🚨 Limite Pedido
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Data limite para fazer o pedido considerando o lead time do fornecedor</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center cursor-help">
                            Lead Time
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Tempo de entrega do fornecedor em dias</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="font-semibold text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insumosFiltradosOrdenados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                          <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                          {temFiltrosAtivos ? 'Nenhum insumo encontrado com os filtros aplicados' : 'Nenhum insumo cadastrado. Clique em "Novo Insumo" para começar.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      insumosFiltradosOrdenados.map(item => (
                        <TableRow 
                          key={item.id} 
                          className={`
                            transition-colors
                            ${item.status_estoque === 'Sem Estoque' ? 'bg-black/5 hover:bg-black/10 border-l-4 border-l-black' : ''} 
                            ${item.status_estoque === 'Crítico' ? 'bg-destructive/5 hover:bg-destructive/10 border-l-4 border-l-destructive' : ''} 
                            ${item.status_estoque === 'Atenção' ? 'bg-warning/5 hover:bg-warning/10 border-l-4 border-l-warning' : ''}
                            ${item.status_estoque === 'Normal' ? 'hover:bg-muted/50' : ''}
                          `}
                        >
                          <TableCell>
                            <div>
                              <span className="font-semibold">{item.nome_insumo}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground font-mono">{item.codigo_insumo}</span>
                                <Badge variant="outline" className="font-normal text-xs h-5">
                                  {item.categoria}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{getStatusBadge(item.status_estoque)}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold text-lg ${
                              item.status_estoque === 'Sem Estoque' ? 'text-black' :
                              item.status_estoque === 'Crítico' ? 'text-destructive' : 
                              item.status_estoque === 'Atenção' ? 'text-warning' : ''
                            }`}>
                              {item.quantidade_atual}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unidade_medida}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${item.quantidade_atual <= item.ponto_pedido ? 'text-warning' : 'text-muted-foreground'}`}>
                              {item.ponto_pedido}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.duracao_media_por_unidade !== null ? (
                              <Tooltip>
                                <TooltipTrigger className="cursor-help">
                                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                                    ~{item.duracao_media_por_unidade}d
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>1 unidade dura em média <strong>{item.duracao_media_por_unidade} dias</strong></p>
                                  <p className="text-xs text-muted-foreground">Baseado em {item.retiradas_count} retiradas</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger className="cursor-help">
                                  <span className="text-xs text-muted-foreground italic">Aguardando</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Necessário mínimo de 2 retiradas para calcular</p>
                                  <p className="text-xs text-muted-foreground">Atual: {item.retiradas_count} retirada(s)</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell className="text-center bg-primary/5">
                            {item.dias_restantes !== null ? (
                              <span className={`inline-flex items-center justify-center font-bold px-3 py-1.5 rounded-full text-sm ${
                                item.dias_restantes === 0 ? 'bg-black/20 text-black' :
                                item.dias_restantes < 5 ? 'bg-destructive/20 text-destructive' : 
                                item.dias_restantes < 10 ? 'bg-warning/20 text-warning' : 
                                'bg-success/20 text-success'
                              }`}>
                                {item.dias_restantes} dias
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-sm font-medium ${
                              item.data_ruptura && item.dias_restantes !== null && item.dias_restantes <= 7 
                                ? 'text-destructive' 
                                : 'text-muted-foreground'
                            }`}>
                              {formatDate(item.data_ruptura)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-sm font-medium ${
                              item.status_estoque === 'Crítico' 
                                ? 'text-destructive font-bold' 
                                : item.status_estoque === 'Atenção'
                                ? 'text-warning'
                                : 'text-muted-foreground'
                            }`}>
                              {formatDate(item.data_limite_pedido)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-normal">
                              {item.lead_time_dias}d
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-center">
                              <Button size="icon" variant="outline" onClick={() => openMovimentacao(item, 'entrada')} title="Entrada" className="h-8 w-8 border-success/50 hover:bg-success/10 hover:border-success">
                                <Plus className="h-4 w-4 text-success" />
                              </Button>
                              <Button size="icon" variant="outline" onClick={() => openMovimentacao(item, 'retirada')} title="Retirada" className="h-8 w-8 border-destructive/50 hover:bg-destructive/10 hover:border-destructive">
                                <Minus className="h-4 w-4 text-destructive" />
                              </Button>
                              <Button size="icon" variant="outline" onClick={() => openEditarInsumo(item)} title="Editar" className="h-8 w-8 border-primary/50 hover:bg-primary/10 hover:border-primary">
                                <Pencil className="h-4 w-4 text-primary" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="outline" title="Excluir" className="h-8 w-8 border-destructive/50 hover:bg-destructive/10 hover:border-destructive">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertCircle className="h-5 w-5 text-destructive" />
                                      Confirmar exclusão
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir o insumo <strong>"{item.nome_insumo}"</strong>? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => excluirInsumoMutation.mutate(item.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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

          {/* Histórico de Movimentações */}
          <HistoricoMovimentacoes insumos={insumos} />

          {/* Modal Editar Insumo */}
          <Dialog open={editarInsumoOpen} onOpenChange={setEditarInsumoOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Pencil className="h-5 w-5 text-primary" />
                  Editar Insumo
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                {/* Seção: Identificação */}
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Package className="h-4 w-4 text-primary" />
                    Identificação do Produto
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Código *</Label>
                      <Input 
                        value={editInsumo.codigo_insumo} 
                        onChange={e => setEditInsumo(p => ({ ...p, codigo_insumo: e.target.value.toUpperCase() }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome *</Label>
                      <Input 
                        value={editInsumo.nome_insumo} 
                        onChange={e => setEditInsumo(p => ({ ...p, nome_insumo: e.target.value.toUpperCase() }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Categoria *</Label>
                      <Select value={editInsumo.categoria} onValueChange={v => setEditInsumo(p => ({ ...p, categoria: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Unidade de Medida *</Label>
                      <Select value={editInsumo.unidade_medida} onValueChange={v => setEditInsumo(p => ({ ...p, unidade_medida: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Quantidade Mínima em Estoque</Label>
                    <Input 
                      type="number" 
                      value={editInsumo.quantidade_minima} 
                      onChange={e => setEditInsumo(p => ({ ...p, quantidade_minima: parseInt(e.target.value) || 0 }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                {/* Seção: Configurações de Reposição */}
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Configurações de Reposição
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Lead Time (dias)</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Tempo em dias que o fornecedor leva para entregar após o pedido.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input 
                        type="number" 
                        min={1}
                        value={editInsumo.lead_time_dias} 
                        onChange={e => setEditInsumo(p => ({ ...p, lead_time_dias: parseInt(e.target.value) || 3 }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Estoque Segurança (dias)</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Margem de segurança para cobrir variações de demanda ou atrasos.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input 
                        type="number" 
                        min={0}
                        value={editInsumo.estoque_seguranca_dias} 
                        onChange={e => setEditInsumo(p => ({ ...p, estoque_seguranca_dias: parseInt(e.target.value) || 2 }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Seção: Informações Financeiras - DESTAQUE */}
                <div className="rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    <DollarSign className="h-4 w-4" />
                    Informações Financeiras
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Custo Unitário (R$)</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Custo por unidade para cálculo do valor do estoque.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                        <Input 
                          type="number" 
                          step="0.01"
                          min={0}
                          value={editInsumo.custo_unitario} 
                          onChange={e => setEditInsumo(p => ({ ...p, custo_unitario: parseFloat(e.target.value) || 0 }))}
                          placeholder="0,00"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Qtd. Mínima de Compra</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Quantidade mínima exigida pelo fornecedor (lote, caixa).</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input 
                        type="number" 
                        min={1}
                        value={editInsumo.quantidade_minima_compra} 
                        onChange={e => setEditInsumo(p => ({ ...p, quantidade_minima_compra: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                  </div>
                  
                  {/* Valor estimado de reposição */}
                  {editInsumo.custo_unitario > 0 && editInsumo.quantidade_minima_compra > 0 && (
                    <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Valor estimado por pedido:</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {(editInsumo.custo_unitario * editInsumo.quantidade_minima_compra).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Seção: Fornecedor */}
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ShoppingCart className="h-4 w-4 text-blue-500" />
                    Fornecedor
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Fornecedor Padrão</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Nome do fornecedor principal para este item.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input 
                      value={editInsumo.fornecedor_padrao} 
                      onChange={e => setEditInsumo(p => ({ ...p, fornecedor_padrao: e.target.value }))}
                      placeholder="Ex: Distribuidora ABC"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <Button onClick={handleEditarInsumo} className="w-full h-11 text-base font-medium" disabled={editarInsumoMutation.isPending}>
                  {editarInsumoMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal Movimentação */}
          <Dialog open={movimentacaoOpen} onOpenChange={setMovimentacaoOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {tipoMovimentacao === 'entrada' && <Plus className="h-5 w-5 text-success" />}
                  {tipoMovimentacao === 'retirada' && <Minus className="h-5 w-5 text-destructive" />}
                  {tipoMovimentacao === 'ajuste' && <Settings className="h-5 w-5" />}
                  {tipoMovimentacao === 'entrada' ? 'Registrar Entrada' : tipoMovimentacao === 'retirada' ? 'Registrar Retirada' : 'Ajuste de Estoque'}
                </DialogTitle>
              </DialogHeader>
              {selectedInsumo && (() => {
                // Calcular histórico de preços para este insumo
                const entradasInsumo = movimentacoes.filter(
                  m => m.insumo_id === selectedInsumo.id && m.tipo === 'entrada' && m.valor_unitario
                );
                const ultimaEntrada = entradasInsumo[0];
                const ultimoPreco = ultimaEntrada?.valor_unitario || null;
                const ultimaData = ultimaEntrada?.created_at || null;
                
                // Calcular média mensal de valor unitário
                const mediaValorUnitario = entradasInsumo.length > 0
                  ? entradasInsumo.reduce((sum, e) => sum + (e.valor_unitario || 0), 0) / entradasInsumo.length
                  : null;
                
                // Calcular gasto total no mês
                const gastoMes = entradasInsumo.reduce((sum, e) => sum + (e.valor_total || 0), 0);
                const qtdEntradasMes = entradasInsumo.reduce((sum, e) => sum + e.quantidade, 0);
                
                // Variação de preço em relação à média
                const variacaoPreco = mediaValorUnitario && movimentacao.valor_unitario 
                  ? ((movimentacao.valor_unitario - mediaValorUnitario) / mediaValorUnitario) * 100 
                  : null;
                
                return (
                <div className="space-y-4">
                  {/* Informações do Produto */}
                  <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div>
                      <p className="font-semibold text-lg">{selectedInsumo.nome_insumo}</p>
                      <p className="text-sm text-muted-foreground">{selectedInsumo.codigo_insumo} • {selectedInsumo.categoria}</p>
                    </div>
                  </div>
                  
                  {/* Card Financeiro Expandido para Entradas */}
                  {tipoMovimentacao === 'entrada' ? (
                    <div className="rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        <DollarSign className="h-4 w-4" />
                        Informações Financeiras
                      </div>
                      
                      {/* Histórico de Preços */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex flex-col p-2 rounded bg-background/50">
                          <span className="text-xs text-muted-foreground">Custo Cadastrado</span>
                          <span className="font-semibold">
                            {selectedInsumo.custo_unitario > 0 
                              ? selectedInsumo.custo_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : 'Não informado'}
                          </span>
                        </div>
                        <div className="flex flex-col p-2 rounded bg-background/50">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Último Preço Pago
                          </span>
                          <span className="font-semibold">
                            {ultimoPreco 
                              ? ultimoPreco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : 'Sem histórico'}
                          </span>
                          {ultimaData && (
                            <span className="text-xs text-muted-foreground">
                              em {format(new Date(ultimaData), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col p-2 rounded bg-background/50">
                          <span className="text-xs text-muted-foreground">Média Mensal</span>
                          <span className="font-semibold">
                            {mediaValorUnitario 
                              ? mediaValorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : 'Sem dados'}
                          </span>
                        </div>
                        <div className="flex flex-col p-2 rounded bg-background/50">
                          <span className="text-xs text-muted-foreground">Gasto no Mês</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {gastoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          {qtdEntradasMes > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({qtdEntradasMes} {selectedInsumo.unidade_medida})
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Checkbox de Patrocínio/Doação */}
                      <div className="flex items-center space-x-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <Checkbox
                          id="is_patrocinio"
                          checked={movimentacao.is_patrocinio}
                          onCheckedChange={(checked) => {
                            setMovimentacao(p => ({ 
                              ...p, 
                              is_patrocinio: !!checked,
                              valor_unitario: checked ? 0 : (selectedInsumo?.custo_unitario || 0)
                            }));
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-purple-500" />
                          <label
                            htmlFor="is_patrocinio"
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            Produto de patrocínio/doação (R$ 0,00)
                          </label>
                        </div>
                      </div>

                      {/* Campos de entrada financeira */}
                      <div className="pt-3 border-t border-emerald-500/20 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Valor Unitário Pago {!movimentacao.is_patrocinio && '*'}</Label>
                            <Input 
                              type="number"
                              step="0.01"
                              min={0}
                              value={movimentacao.valor_unitario} 
                              onChange={e => setMovimentacao(p => ({ ...p, valor_unitario: parseFloat(e.target.value) || 0 }))}
                              placeholder="R$ 0,00"
                              className="mt-1"
                              disabled={movimentacao.is_patrocinio}
                            />
                            {movimentacao.is_patrocinio && (
                              <p className="text-xs text-purple-500 mt-1 flex items-center gap-1">
                                <Gift className="h-3 w-3" />
                                Patrocínio/Doação
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs">Fornecedor/Patrocinador</Label>
                            <Input 
                              value={movimentacao.fornecedor} 
                              onChange={e => setMovimentacao(p => ({ ...p, fornecedor: e.target.value }))}
                              placeholder={movimentacao.is_patrocinio ? "Nome do patrocinador" : "Nome do fornecedor"}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {movimentacao.is_patrocinio ? 'Referência / Documento' : 'Nota Fiscal / Referência'}
                          </Label>
                          <Input 
                            value={movimentacao.nota_fiscal} 
                            onChange={e => setMovimentacao(p => ({ ...p, nota_fiscal: e.target.value }))}
                            placeholder={movimentacao.is_patrocinio ? "Documento de doação (opcional)" : "Número da NF (opcional)"}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Card Financeiro Simples para Retiradas/Ajustes */
                    <div className="rounded-lg border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 p-3 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        <DollarSign className="h-4 w-4" />
                        Informações Financeiras
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">Custo Unitário</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {selectedInsumo.custo_unitario > 0 
                              ? selectedInsumo.custo_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : 'Não informado'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">Qtd. Mín. Compra</span>
                          <span className="font-medium">{selectedInsumo.quantidade_minima_compra} {selectedInsumo.unidade_medida}</span>
                        </div>
                      </div>
                      {selectedInsumo.fornecedor_padrao && (
                        <div className="pt-2 border-t border-emerald-500/20">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs text-muted-foreground">Fornecedor:</span>
                            <span className="text-sm font-medium">{selectedInsumo.fornecedor_padrao}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <Label>Quantidade *</Label>
                    <Input 
                      type="number" 
                      min={1}
                      value={movimentacao.quantidade || ''} 
                      onChange={e => setMovimentacao(p => ({ ...p, quantidade: parseInt(e.target.value) || 0 }))}
                      placeholder={`Quantidade em ${selectedInsumo.unidade_medida}`}
                      className="mt-1"
                    />
                  </div>
                  
                  {/* Valor Total e Indicador de Variação */}
                  {tipoMovimentacao === 'entrada' && movimentacao.quantidade > 0 && (
                    <>
                      {/* Indicador especial para patrocínio */}
                      {movimentacao.is_patrocinio ? (
                        <div className="rounded-md p-3 bg-purple-500/10 border border-purple-500/20">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Gift className="h-4 w-4 text-purple-500" />
                              Patrocínio/Doação:
                            </span>
                            <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                              R$ 0,00
                            </span>
                          </div>
                          <p className="text-xs text-purple-500 mt-1">
                            Este item não será contabilizado nos cálculos de gastos e médias de preço.
                          </p>
                        </div>
                      ) : movimentacao.valor_unitario > 0 && (
                        <div className={`rounded-md p-3 space-y-2 ${
                          variacaoPreco !== null && variacaoPreco > 20 
                            ? 'bg-destructive/10 border-2 border-destructive/50' 
                            : 'bg-emerald-500/10 border border-emerald-500/20'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Valor total da compra:</span>
                            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                              {(movimentacao.quantidade * movimentacao.valor_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          
                          {/* Alerta destacado para variação > 20% */}
                          {variacaoPreco !== null && variacaoPreco > 20 && (
                            <div className="flex items-start gap-2 p-2 rounded bg-destructive/20 border border-destructive/30">
                              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-semibold text-destructive">Preço acima da média!</p>
                                <p className="text-xs text-destructive/80">
                                  O valor unitário está <strong>{variacaoPreco.toFixed(1)}% acima</strong> da média histórica 
                                  ({mediaValorUnitario?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). 
                                  Verifique antes de confirmar.
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {/* Indicador normal para outras variações */}
                          {variacaoPreco !== null && Math.abs(variacaoPreco) > 0.5 && variacaoPreco <= 20 && (
                            <div className={`flex items-center gap-1 text-xs ${variacaoPreco > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                              {variacaoPreco > 0 ? (
                                <>
                                  <TrendingUp className="h-3 w-3" />
                                  <span>{Math.abs(variacaoPreco).toFixed(1)}% acima da média histórica</span>
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="h-3 w-3" />
                                  <span>{Math.abs(variacaoPreco).toFixed(1)}% abaixo da média histórica</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Valor estimado para retiradas/ajustes */}
                  {tipoMovimentacao !== 'entrada' && movimentacao.quantidade > 0 && selectedInsumo.custo_unitario > 0 && (
                    <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Valor estimado:</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {(movimentacao.quantidade * selectedInsumo.custo_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {tipoMovimentacao === 'retirada' && (
                    <div>
                      <Label>Setor *</Label>
                      <Select value={movimentacao.setor} onValueChange={v => setMovimentacao(p => ({ ...p, setor: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
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
                      readOnly
                      disabled
                      className="mt-1 bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Preenchido automaticamente com o usuário logado</p>
                  </div>
                  
                  <div>
                    <Label>Observação</Label>
                    <Textarea 
                      value={movimentacao.observacao} 
                      onChange={e => setMovimentacao(p => ({ ...p, observacao: e.target.value }))}
                      placeholder="Observações adicionais (opcional)"
                      className="mt-1"
                    />
                  </div>
                  
                  <Button 
                    onClick={handleRegistrarMovimentacao} 
                    className={`w-full ${tipoMovimentacao === 'entrada' ? 'bg-success hover:bg-success/90' : tipoMovimentacao === 'retirada' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                    disabled={registrarMovimentacaoMutation.isPending}
                  >
                    {registrarMovimentacaoMutation.isPending ? 'Registrando...' : 'Confirmar'}
                  </Button>
                </div>
              );
              })()}
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </Layout>
  );
}
