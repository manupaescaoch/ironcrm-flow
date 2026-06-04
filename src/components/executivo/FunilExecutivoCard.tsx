import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp } from 'lucide-react';
import { FunilItem } from '@/components/executivo/constants';

interface FunilExecutivoCardProps {
  funilData: FunilItem[];
}

export const FunilExecutivoCard = memo(function FunilExecutivoCard({ funilData }: FunilExecutivoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> Funil Executivo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-center">Quantidade</TableHead>
              <TableHead className="text-center">Conversão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {funilData.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{item.etapa}</TableCell>
                <TableCell className="text-center text-lg font-semibold">{item.quantidade}</TableCell>
                <TableCell className="text-center">
                  {item.conversao !== null ? (
                    <span className={item.conversao >= 50 ? 'text-green-600' : item.conversao >= 30 ? 'text-amber-600' : 'text-red-600'}>
                      {item.conversao.toFixed(1)}%
                    </span>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});
