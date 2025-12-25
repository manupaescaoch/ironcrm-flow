import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calculator } from 'lucide-react';
import { InteracaoComLead, MESES } from './constants';
import { formatComissaoCurrency, formatComissaoDate } from '@/utils/comissoesMappers';

interface MatriculasDetailTableProps {
  interacoes: InteracaoComLead[];
  mes: string;
  ano: string;
}

export const MatriculasDetailTable = memo(function MatriculasDetailTable({
  interacoes,
  mes,
  ano,
}: MatriculasDetailTableProps) {
  const mesLabel = MESES.find(m => m.value === mes)?.label || mes;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Detalhamento das Matrículas - {mesLabel} {ano}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {interacoes.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            Nenhuma matrícula encontrada neste período
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Cadastrador</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Cadastrador (3%)</TableHead>
                  <TableHead className="text-right">Fechador (2%)</TableHead>
                  <TableHead>Resp. Fechamento</TableHead>
                  <TableHead>Treinador</TableHead>
                  <TableHead>Data Fechamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interacoes.map((int) => (
                  <TableRow key={int.id}>
                    <TableCell className="font-medium">{int.lead_nome}</TableCell>
                    <TableCell>{int.lead_cadastrado_por || '-'}</TableCell>
                    <TableCell>{int.plano_escolhido || '-'}</TableCell>
                    <TableCell className="text-right">{formatComissaoCurrency(int.valor_plano || 0)}</TableCell>
                    <TableCell className="text-right text-green-600">
                      <div>{formatComissaoCurrency(int.comissao_comercial || 0)}</div>
                      {(int.comissao_comercial || 0) > 0 && int.lead_cadastrado_por && (
                        <div className="text-xs text-muted-foreground">{int.lead_cadastrado_por}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-amber-600">
                      <div>{formatComissaoCurrency(int.comissao_recepcao || 0)}</div>
                      {(int.comissao_recepcao || 0) > 0 && int.responsavel_fechamento && (
                        <div className="text-xs text-muted-foreground">{int.responsavel_fechamento}</div>
                      )}
                    </TableCell>
                    <TableCell>{int.responsavel_fechamento || '-'}</TableCell>
                    <TableCell>{int.treinador_responsavel || '-'}</TableCell>
                    <TableCell>{formatComissaoDate(int.data_fechamento)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
