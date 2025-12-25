import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dumbbell, Award } from 'lucide-react';
import { TreinadorItem } from '@/components/executivo/constants';
import { formatExecutivoCurrency } from '@/utils/executivoMappers';

interface TreinadorPerformanceCardProps {
  data: TreinadorItem[];
}

export const TreinadorPerformanceCard = memo(function TreinadorPerformanceCard({ data }: TreinadorPerformanceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-primary" /> Performance dos Treinadores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Treinador</TableHead>
              <TableHead className="text-center">Aulas Experimentais</TableHead>
              <TableHead className="text-center">Matrículas</TableHead>
              <TableHead className="text-center">Conversão (%)</TableHead>
              <TableHead className="text-center">Bônus/Aluno</TableHead>
              <TableHead className="text-right">Bônus Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  {i === 0 && item.matriculas > 0 && <Award className="w-4 h-4 inline mr-2 text-amber-500" />}
                  {item.treinador}
                </TableCell>
                <TableCell className="text-center">{item.aulas}</TableCell>
                <TableCell className="text-center font-semibold">{item.matriculas}</TableCell>
                <TableCell className="text-center">
                  <span className={item.conversao >= 50 ? 'text-green-600 font-medium' : ''}>
                    {item.conversao.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-center">{formatExecutivoCurrency(item.bonusPorAluno)}</TableCell>
                <TableCell className="text-right font-bold text-green-600">
                  {formatExecutivoCurrency(item.bonusTotal)}
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum treinador com aulas no período
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
        {/* Bonus Rules */}
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium mb-2">Regras de Bônus:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <span>1-4 matrículas: R$20/aluno</span>
            <span>5-7 matrículas: R$25/aluno</span>
            <span>8-10 matrículas: R$30/aluno</span>
            <span>11+ matrículas: R$40/aluno</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
