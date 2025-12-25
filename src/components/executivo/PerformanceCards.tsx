import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Trophy, Award } from 'lucide-react';
import { CadastradorItem, FechadorItem } from '@/components/executivo/constants';
import { formatExecutivoCurrency } from '@/utils/executivoMappers';

interface PerformanceCadastradorCardProps {
  data: CadastradorItem[];
}

export const PerformanceCadastradorCard = memo(function PerformanceCadastradorCard({ data }: PerformanceCadastradorCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" /> Performance por Cadastrador
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cadastrador</TableHead>
              <TableHead className="text-center">Leads</TableHead>
              <TableHead className="text-center">Agendamentos</TableHead>
              <TableHead className="text-center">Matrículas</TableHead>
              <TableHead className="text-center">Conversão (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  {i === 0 && item.matriculas > 0 && <Award className="w-4 h-4 inline mr-2 text-amber-500" />}
                  {item.cadastrador}
                </TableCell>
                <TableCell className="text-center">{item.leads}</TableCell>
                <TableCell className="text-center">{item.agendamentos}</TableCell>
                <TableCell className="text-center font-semibold">{item.matriculas}</TableCell>
                <TableCell className="text-center">
                  <span className={item.conversao >= 50 ? 'text-green-600 font-medium' : ''}>
                    {item.conversao.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum dado disponível
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});

interface PerformanceFechadorCardProps {
  data: FechadorItem[];
}

export const PerformanceFechadorCard = memo(function PerformanceFechadorCard({ data }: PerformanceFechadorCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" /> Performance por Fechador
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fechador</TableHead>
              <TableHead className="text-center">Comparecimentos</TableHead>
              <TableHead className="text-center">Matrículas</TableHead>
              <TableHead className="text-center">Conversão (%)</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  {i === 0 && item.matriculas > 0 && <Award className="w-4 h-4 inline mr-2 text-amber-500" />}
                  {item.fechador}
                </TableCell>
                <TableCell className="text-center">{item.comparecimentos}</TableCell>
                <TableCell className="text-center font-semibold">{item.matriculas}</TableCell>
                <TableCell className="text-center">
                  <span className={item.conversao >= 50 ? 'text-green-600 font-medium' : ''}>
                    {item.conversao.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right font-bold text-green-600">
                  {formatExecutivoCurrency(item.valorTotal)}
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum dado disponível
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});
