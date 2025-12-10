import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Interacao } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign, Users, TrendingUp, Calculator, Briefcase, UserCheck, Award } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InteracaoComLead extends Interacao {
  lead_nome?: string;
}

interface ComissaoAgrupada {
  responsavel: string;
  matriculas: number;
  comissao: number;
}

const meses = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function Comissoes() {
  const [loading, setLoading] = useState(false);
  const [interacoes, setInteracoes] = useState<InteracaoComLead[]>([]);
  const [mes, setMes] = useState<string>((new Date().getMonth() + 1).toString());
  const [ano, setAno] = useState<string>(currentYear.toString());
  const [filterFuncionario, setFilterFuncionario] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (mes && ano) {
      fetchComissoes();
    }
  }, [mes, ano]);

  const fetchComissoes = async () => {
    setLoading(true);

    const mesNum = parseInt(mes);
    const anoNum = parseInt(ano);

    // Calculate date range for the selected month
    const startDate = new Date(anoNum, mesNum - 1, 1);
    const endDate = new Date(anoNum, mesNum, 0); // Last day of month

    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Fetch interacoes with fechou_matricula = true and data_fechamento in the range
    const { data: interacoesData, error: interacoesError } = await supabase
      .from('interacoes')
      .select('*, leads(nome)')
      .eq('fechou_matricula', true)
      .gte('data_fechamento', startDateStr)
      .lte('data_fechamento', endDateStr)
      .order('data_fechamento', { ascending: false });

    if (interacoesError) {
      toast({ title: 'Erro ao carregar comissões', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Map the data
    const mappedData: InteracaoComLead[] = (interacoesData || []).map((int: any) => ({
      ...int,
      lead_nome: int.leads?.nome || 'Lead não encontrado',
    }));

    setInteracoes(mappedData);
    setLoading(false);
  };

  // Filter by funcionario
  const filteredInteracoes = useMemo(() => {
    if (!filterFuncionario.trim()) return interacoes;
    const filter = filterFuncionario.toLowerCase();
    return interacoes.filter(
      (int) =>
        int.responsavel_fechamento?.toLowerCase().includes(filter) ||
        int.treinador_responsavel?.toLowerCase().includes(filter) ||
        int.atendido_por?.toLowerCase().includes(filter)
    );
  }, [interacoes, filterFuncionario]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalMatriculas = filteredInteracoes.length;
    const totalValorPlano = filteredInteracoes.reduce((sum, int) => sum + (int.valor_plano || 0), 0);
    const ticketMedio = totalMatriculas > 0 ? totalValorPlano / totalMatriculas : 0;
    const totalComissaoComercial = filteredInteracoes.reduce((sum, int) => sum + (int.comissao_comercial || 0), 0);
    const totalComissaoRecepcao = filteredInteracoes.reduce((sum, int) => sum + (int.comissao_recepcao || 0), 0);
    const totalComissoes = totalComissaoComercial + totalComissaoRecepcao;

    return {
      totalMatriculas,
      ticketMedio,
      totalComissaoComercial,
      totalComissaoRecepcao,
      totalComissoes,
    };
  }, [filteredInteracoes]);

  // Group by comercial - atendido_por for comercial, quem_agendou for espontaneo_recepcao
  const comissoesComercial = useMemo(() => {
    const grouped = new Map<string, { matriculas: number; comissao: number }>();

    filteredInteracoes.forEach((int) => {
      const comissao = int.comissao_comercial || 0;
      if (comissao <= 0) return; // Skip records with no commercial commission

      const tipoAtendimento = (int as any).tipo_atendimento;
      const quemAgendou = (int as any).quem_agendou;
      
      let responsavel: string;
      if (tipoAtendimento === 'comercial') {
        // Commercial type: attribute to atendido_por
        responsavel = int.atendido_por || 'Não informado';
      } else if (tipoAtendimento === 'espontaneo_recepcao' && quemAgendou) {
        // Walk-in with prior scheduling: attribute to quem_agendou
        responsavel = quemAgendou;
      } else {
        return; // Skip if no commercial attribution
      }
      
      const current = grouped.get(responsavel) || { matriculas: 0, comissao: 0 };
      grouped.set(responsavel, {
        matriculas: current.matriculas + 1,
        comissao: current.comissao + comissao,
      });
    });

    return Array.from(grouped.entries())
      .map(([responsavel, data]) => ({
        responsavel,
        ...data,
      }))
      .sort((a, b) => b.comissao - a.comissao);
  }, [filteredInteracoes]);

  // Group by recepção (responsavel_fechamento for espontaneo_recepcao)
  const comissoesRecepcao = useMemo(() => {
    const grouped = new Map<string, { matriculas: number; comissao: number }>();

    filteredInteracoes.forEach((int) => {
      const comissao = int.comissao_recepcao || 0;
      if (comissao <= 0) return; // Skip records with no reception commission

      // For reception commissions, always use responsavel_fechamento
      const responsavel = int.responsavel_fechamento || 'Não informado';
      const current = grouped.get(responsavel) || { matriculas: 0, comissao: 0 };
      grouped.set(responsavel, {
        matriculas: current.matriculas + 1,
        comissao: current.comissao + comissao,
      });
    });

    return Array.from(grouped.entries())
      .map(([responsavel, data]) => ({
        responsavel,
        ...data,
      }))
      .sort((a, b) => b.comissao - a.comissao);
  }, [filteredInteracoes]);

  // Helper function to calculate bonus per student based on number of enrollments
  const calculateBonusPorAluno = (matriculas: number): number => {
    if (matriculas === 0) return 0;
    if (matriculas >= 1 && matriculas <= 4) return 20;
    if (matriculas >= 5 && matriculas <= 7) return 25;
    if (matriculas >= 8 && matriculas <= 10) return 30;
    if (matriculas >= 11) return 40;
    return 0;
  };

  // Group by treinador responsável pelo fechamento with bonus calculation
  const bonusTreinadores = useMemo(() => {
    const grouped = new Map<string, { matriculas: number; faturamento: number }>();

    // Only consider interactions with a trainer assigned
    filteredInteracoes.forEach((int) => {
      const treinador = int.treinador_responsavel;
      if (!treinador || treinador.trim() === '') return; // Skip rows without trainer
      
      const current = grouped.get(treinador) || { matriculas: 0, faturamento: 0 };
      grouped.set(treinador, {
        matriculas: current.matriculas + 1,
        faturamento: current.faturamento + (int.valor_plano || 0),
      });
    });

    return Array.from(grouped.entries())
      .map(([treinador, data]) => {
        const bonusPorAluno = calculateBonusPorAluno(data.matriculas);
        const bonusTotal = data.matriculas * bonusPorAluno;
        return {
          treinador,
          matriculas: data.matriculas,
          faturamento: data.faturamento,
          bonusPorAluno,
          bonusTotal,
        };
      })
      .sort((a, b) => b.bonusTotal - a.bonusTotal); // Sort by bonus_total descending
  }, [filteredInteracoes]);

  // Calculate trainer bonus totals
  const treinadorStats = useMemo(() => {
    const totalMatriculas = bonusTreinadores.reduce((sum, t) => sum + t.matriculas, 0);
    const totalFaturamento = bonusTreinadores.reduce((sum, t) => sum + t.faturamento, 0);
    const totalBonus = bonusTreinadores.reduce((sum, t) => sum + t.bonusTotal, 0);
    return { totalMatriculas, totalFaturamento, totalBonus };
  }, [bonusTreinadores]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Comissões do Mês</h1>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={ano} onValueChange={setAno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Funcionário (opcional)</Label>
                <Input
                  value={filterFuncionario}
                  onChange={(e) => setFilterFuncionario(e.target.value)}
                  placeholder="Filtrar por nome..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Matrículas</p>
                      <p className="text-2xl font-bold">{stats.totalMatriculas}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ticket Médio</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.ticketMedio)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Comercial</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalComissaoComercial)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Recepção</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalComissaoRecepcao)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Comissões</p>
                      <p className="text-2xl font-bold text-primary">{formatCurrency(stats.totalComissoes)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Commission Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-green-500" />
                    Comissões Comercial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {comissoesComercial.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhuma comissão neste período
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-center">Matrículas</TableHead>
                          <TableHead className="text-right">Comissão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comissoesComercial.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.responsavel}</TableCell>
                            <TableCell className="text-center">{item.matriculas}</TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(item.comissao)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-center font-bold">
                            {comissoesComercial.reduce((sum, i) => sum + i.matriculas, 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-green-600">
                            {formatCurrency(stats.totalComissaoComercial)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Recepção Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-500" />
                    Comissões Recepção
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {comissoesRecepcao.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhuma comissão neste período
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-center">Matrículas</TableHead>
                          <TableHead className="text-right">Comissão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comissoesRecepcao.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.responsavel}</TableCell>
                            <TableCell className="text-center">{item.matriculas}</TableCell>
                            <TableCell className="text-right font-semibold text-amber-600">
                              {formatCurrency(item.comissao)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-center font-bold">
                            {comissoesRecepcao.reduce((sum, i) => sum + i.matriculas, 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-amber-600">
                            {formatCurrency(stats.totalComissaoRecepcao)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
            </Card>

            {/* Treinador Responsável with Bonus Table */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-500" />
                  Fechamentos e Bônus por Treinador Responsável
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card className="bg-blue-500/5 border-blue-500/20">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total de matrículas fechadas</p>
                          <p className="text-xl font-bold">{treinadorStats.totalMatriculas}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-500/5 border-purple-500/20">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Faturamento Total</p>
                          <p className="text-xl font-bold">{formatCurrency(treinadorStats.totalFaturamento)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-500/5 border-green-500/20">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                          <Award className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total de bônus a pagar</p>
                          <p className="text-xl font-bold text-green-600">{formatCurrency(treinadorStats.totalBonus)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Bonus Rules Info */}
                <div className="mb-4 p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Regras de bônus por matrícula:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <span>1-4 alunos: R$ 20/aluno</span>
                    <span>5-7 alunos: R$ 25/aluno</span>
                    <span>8-10 alunos: R$ 30/aluno</span>
                    <span>11+ alunos: R$ 40/aluno</span>
                  </div>
                </div>

                {bonusTreinadores.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum fechamento com treinador responsável neste período
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Treinador</TableHead>
                        <TableHead className="text-center">Matrículas Fechadas</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">Bônus/Aluno</TableHead>
                        <TableHead className="text-right">Bônus Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bonusTreinadores.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.treinador}</TableCell>
                          <TableCell className="text-center">{item.matriculas}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.faturamento)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.bonusPorAluno)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {formatCurrency(item.bonusTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className="text-center font-bold">
                          {treinadorStats.totalMatriculas}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(treinadorStats.totalFaturamento)}
                        </TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatCurrency(treinadorStats.totalBonus)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

            {/* Detailed Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Detalhamento das Matrículas - {meses.find(m => m.value === mes)?.label} {ano}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredInteracoes.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhuma matrícula encontrada neste período
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Comercial</TableHead>
                          <TableHead className="text-right">Recepção</TableHead>
                          <TableHead>Resp. Fechamento</TableHead>
                          <TableHead>Treinador</TableHead>
                          <TableHead>Data Fechamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInteracoes.map((int) => {
                          const origemFechamento = (int as any).origem_fechamento;
                          const quemAgendou = (int as any).quem_agendou;
                          return (
                          <TableRow key={int.id}>
                            <TableCell className="font-medium">{int.lead_nome}</TableCell>
                            <TableCell>
                              {origemFechamento === 'agendamento_comercial' ? 'Agendamento' : 
                               origemFechamento === 'espontaneo_recepcao' ? (quemAgendou ? 'Espontâneo (c/ agend.)' : 'Espontâneo') : '-'}
                            </TableCell>
                            <TableCell>{int.plano_escolhido || '-'}</TableCell>
                            <TableCell className="text-right">{formatCurrency(int.valor_plano || 0)}</TableCell>
                            <TableCell className="text-right text-green-600">
                              <div>{formatCurrency(int.comissao_comercial || 0)}</div>
                              {(int.comissao_comercial || 0) > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {origemFechamento === 'agendamento_comercial' ? int.responsavel_fechamento : quemAgendou}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-amber-600">
                              <div>{formatCurrency(int.comissao_recepcao || 0)}</div>
                              {(int.comissao_recepcao || 0) > 0 && (
                                <div className="text-xs text-muted-foreground">{int.responsavel_fechamento}</div>
                              )}
                            </TableCell>
                            <TableCell>{int.responsavel_fechamento || '-'}</TableCell>
                            <TableCell>{int.treinador_responsavel || '-'}</TableCell>
                            <TableCell>{formatDate(int.data_fechamento)}</TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}