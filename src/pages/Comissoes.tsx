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
import { Loader2, DollarSign, Users, TrendingUp, Calculator, Briefcase, UserCheck } from 'lucide-react';
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

  // Group by comercial (responsavel_fechamento)
  const comissoesComercial = useMemo(() => {
    const grouped = new Map<string, { matriculas: number; comissao: number }>();

    filteredInteracoes.forEach((int) => {
      const responsavel = int.responsavel_fechamento || 'Não informado';
      const current = grouped.get(responsavel) || { matriculas: 0, comissao: 0 };
      grouped.set(responsavel, {
        matriculas: current.matriculas + 1,
        comissao: current.comissao + (int.comissao_comercial || 0),
      });
    });

    return Array.from(grouped.entries())
      .map(([responsavel, data]) => ({
        responsavel,
        ...data,
      }))
      .sort((a, b) => b.comissao - a.comissao);
  }, [filteredInteracoes]);

  // Group by recepção (atendido_por)
  const comissoesRecepcao = useMemo(() => {
    const grouped = new Map<string, { matriculas: number; comissao: number }>();

    filteredInteracoes.forEach((int) => {
      const responsavel = int.atendido_por || 'Não informado';
      const current = grouped.get(responsavel) || { matriculas: 0, comissao: 0 };
      grouped.set(responsavel, {
        matriculas: current.matriculas + 1,
        comissao: current.comissao + (int.comissao_recepcao || 0),
      });
    });

    return Array.from(grouped.entries())
      .map(([responsavel, data]) => ({
        responsavel,
        ...data,
      }))
      .sort((a, b) => b.comissao - a.comissao);
  }, [filteredInteracoes]);

  // Group by treinador responsável pelo fechamento
  const comissoesTreinador = useMemo(() => {
    const grouped = new Map<string, { matriculas: number; faturamento: number }>();

    filteredInteracoes.forEach((int) => {
      const treinador = int.treinador_responsavel || 'Não informado';
      const current = grouped.get(treinador) || { matriculas: 0, faturamento: 0 };
      grouped.set(treinador, {
        matriculas: current.matriculas + 1,
        faturamento: current.faturamento + (int.valor_plano || 0),
      });
    });

    return Array.from(grouped.entries())
      .map(([treinador, data]) => ({
        treinador,
        ...data,
      }))
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [filteredInteracoes]);

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
                      <p className="text-sm text-muted-foreground">Comercial (3%)</p>
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
                      <p className="text-sm text-muted-foreground">Recepção (2%)</p>
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
              {/* Comercial Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-green-500" />
                    Comissões Comercial (3%)
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
                    Comissões Recepção (2%)
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

            {/* Treinador Responsável Table */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Fechamentos por Treinador Responsável
                </CardTitle>
              </CardHeader>
              <CardContent>
                {comissoesTreinador.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum fechamento neste período
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Treinador</TableHead>
                        <TableHead className="text-center">Matrículas Fechadas</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comissoesTreinador.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.treinador}</TableCell>
                          <TableCell className="text-center">{item.matriculas}</TableCell>
                          <TableCell className="text-right font-semibold text-blue-600">
                            {formatCurrency(item.faturamento)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className="text-center font-bold">
                          {comissoesTreinador.reduce((sum, i) => sum + i.matriculas, 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          {formatCurrency(comissoesTreinador.reduce((sum, i) => sum + i.faturamento, 0))}
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
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Comercial (3%)</TableHead>
                          <TableHead className="text-right">Recepção (2%)</TableHead>
                          <TableHead>Resp. Comercial</TableHead>
                          <TableHead>Resp. Recepção</TableHead>
                          <TableHead>Data Fechamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInteracoes.map((int) => (
                          <TableRow key={int.id}>
                            <TableCell className="font-medium">{int.lead_nome}</TableCell>
                            <TableCell>{int.plano_escolhido || '-'}</TableCell>
                            <TableCell className="text-right">{formatCurrency(int.valor_plano || 0)}</TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(int.comissao_comercial || 0)}
                            </TableCell>
                            <TableCell className="text-right text-amber-600">
                              {formatCurrency(int.comissao_recepcao || 0)}
                            </TableCell>
                            <TableCell>{int.responsavel_fechamento || '-'}</TableCell>
                            <TableCell>{int.treinador_responsavel || int.atendido_por || '-'}</TableCell>
                            <TableCell>{formatDate(int.data_fechamento)}</TableCell>
                          </TableRow>
                        ))}
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