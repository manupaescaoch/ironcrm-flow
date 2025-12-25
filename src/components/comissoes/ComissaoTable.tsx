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
import { Briefcase, UserCheck } from 'lucide-react';
import { ComissaoAgrupada } from './constants';
import { formatComissaoCurrency } from '@/utils/comissoesMappers';

interface ComissaoTableProps {
  title: string;
  type: 'cadastrador' | 'fechador';
  data: ComissaoAgrupada[];
  totalComissao: number;
  onPersonClick: (name: string, type: 'cadastrador' | 'fechador') => void;
}

export const ComissaoTable = memo(function ComissaoTable({
  title,
  type,
  data,
  totalComissao,
  onPersonClick,
}: ComissaoTableProps) {
  const Icon = type === 'cadastrador' ? Briefcase : UserCheck;
  const colorClass = type === 'cadastrador' ? 'text-green' : 'text-amber';
  const iconColor = type === 'cadastrador' ? 'text-green-500' : 'text-amber-500';
  const textColor = type === 'cadastrador' ? 'text-green-600' : 'text-amber-600';
  const linkColor = type === 'cadastrador' ? 'text-green-700' : 'text-amber-700';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            Nenhuma comissão neste período
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{type === 'cadastrador' ? 'Cadastrador' : 'Responsável Fechamento'}</TableHead>
                <TableHead className="text-center">Matrículas</TableHead>
                <TableHead className="text-right">Comissão ({type === 'cadastrador' ? '3%' : '2%'})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow 
                  key={index} 
                  className="cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => onPersonClick(item.responsavel, type)}
                >
                  <TableCell className={`font-medium ${linkColor} underline underline-offset-2`}>
                    {item.responsavel}
                  </TableCell>
                  <TableCell className="text-center">{item.matriculas}</TableCell>
                  <TableCell className={`text-right font-semibold ${textColor}`}>
                    {formatComissaoCurrency(item.comissao)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-center font-bold">
                  {data.reduce((sum, i) => sum + i.matriculas, 0)}
                </TableCell>
                <TableCell className={`text-right font-bold ${textColor}`}>
                  {formatComissaoCurrency(totalComissao)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
});
