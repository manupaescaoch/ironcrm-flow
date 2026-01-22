import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { History, Calendar, User, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { cn } from '@/lib/utils';

interface PagamentoHistorico {
  id: string;
  nomeAluno: string;
  telefone: string | null;
  plano: string;
  dataVencimento: Date;
  dataConfirmacao: Date;
  confirmadoPor: string | null;
  observacao: string | null;
}

export function HistoricoPagamentos() {
  const { unidadeAtual } = useUnidade();
  const [dataInicio, setDataInicio] = useState(() => 
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [dataFim, setDataFim] = useState(() => 
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );

  const { data: pagamentos, isLoading } = useQuery({
    queryKey: ['historico-pagamentos', unidadeAtual?.id, dataInicio, dataFim],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];

      const { data, error } = await supabase
        .from('pagamentos_mensais')
        .select(`
          id,
          data_vencimento,
          data_confirmacao,
          confirmado_por,
          observacao,
          interacao_id,
          lead_id,
          interacoes!inner (
            plano_escolhido,
            leads!inner (
              nome,
              telefone
            )
          )
        `)
        .eq('unidade_id', unidadeAtual.id)
        .gte('data_confirmacao', dataInicio)
        .lte('data_confirmacao', dataFim)
        .order('data_confirmacao', { ascending: false });

      if (error) throw error;

      return (data || []).map((p): PagamentoHistorico => {
        const interacao = p.interacoes as any;
        const lead = interacao?.leads;
        return {
          id: p.id,
          nomeAluno: lead?.nome || 'N/A',
          telefone: lead?.telefone || null,
          plano: interacao?.plano_escolhido || 'N/A',
          dataVencimento: new Date(p.data_vencimento),
          dataConfirmacao: new Date(p.data_confirmacao),
          confirmadoPor: p.confirmado_por,
          observacao: p.observacao,
        };
      });
    },
    enabled: !!unidadeAtual?.id,
  });

  const handlePeriodoRapido = (meses: number) => {
    const hoje = new Date();
    if (meses === 0) {
      // Mês atual
      setDataInicio(format(startOfMonth(hoje), 'yyyy-MM-dd'));
      setDataFim(format(endOfMonth(hoje), 'yyyy-MM-dd'));
    } else {
      // Últimos X meses
      const inicio = startOfMonth(subMonths(hoje, meses));
      setDataInicio(format(inicio, 'yyyy-MM-dd'));
      setDataFim(format(endOfMonth(hoje), 'yyyy-MM-dd'));
    }
  };

  const totalPagamentos = pagamentos?.length || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Pagamentos Confirmados
          </CardTitle>
          <Badge variant="secondary" className="w-fit">
            {totalPagamentos} {totalPagamentos === 1 ? 'pagamento' : 'pagamentos'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros de Período */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-[150px]"
            />
            <span className="text-muted-foreground">até</span>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-[150px]"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePeriodoRapido(0)}
            >
              Este mês
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePeriodoRapido(3)}
            >
              Últimos 3 meses
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePeriodoRapido(6)}
            >
              Últimos 6 meses
            </Button>
          </div>
        </div>

        {/* Tabela de Histórico */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : pagamentos && pagamentos.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Confirmação</TableHead>
                  <TableHead>Confirmado por</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map((pagamento) => (
                  <TableRow key={pagamento.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{pagamento.nomeAluno}</span>
                        {pagamento.telefone && (
                          <span className="text-xs text-muted-foreground">
                            {pagamento.telefone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{pagamento.plano}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(pagamento.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        {format(pagamento.dataConfirmacao, 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {pagamento.confirmadoPor ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{pagamento.confirmadoPor}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {pagamento.observacao ? (
                        <span className="text-sm text-muted-foreground truncate block">
                          {pagamento.observacao}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum pagamento confirmado no período selecionado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
