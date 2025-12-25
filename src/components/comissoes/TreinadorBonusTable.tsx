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
import { Award, Users } from 'lucide-react';
import { TreinadorBonus, TreinadorStats } from './constants';
import { formatComissaoCurrency } from '@/utils/comissoesMappers';

interface TreinadorBonusTableProps {
  bonusTreinadores: TreinadorBonus[];
  treinadorStats: TreinadorStats;
}

export const TreinadorBonusTable = memo(function TreinadorBonusTable({
  bonusTreinadores,
  treinadorStats,
}: TreinadorBonusTableProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-500" />
          Fechamentos e Bônus por Treinador Responsável
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de bônus a pagar</p>
                  <p className="text-xl font-bold text-green-600">{formatComissaoCurrency(treinadorStats.totalBonus)}</p>
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
                <TableHead className="text-center">Aulas</TableHead>
                <TableHead className="text-center">Matrículas</TableHead>
                <TableHead className="text-center">Conversão</TableHead>
                <TableHead className="text-right">Bônus/Aluno</TableHead>
                <TableHead className="text-right">Bônus Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bonusTreinadores.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.treinador}</TableCell>
                  <TableCell className="text-center">{item.aulas}</TableCell>
                  <TableCell className="text-center">{item.matriculas}</TableCell>
                  <TableCell className="text-center">{item.conversao.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{formatComissaoCurrency(item.bonusPorAluno)}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    {formatComissaoCurrency(item.bonusTotal)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-center font-bold">
                  {bonusTreinadores.reduce((sum, t) => sum + t.aulas, 0)}
                </TableCell>
                <TableCell className="text-center font-bold">
                  {treinadorStats.totalMatriculas}
                </TableCell>
                <TableCell className="text-center">-</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right font-bold text-green-600">
                  {formatComissaoCurrency(treinadorStats.totalBonus)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
});
