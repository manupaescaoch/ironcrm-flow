import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import { AgendaPresencaData } from '@/components/executivo/constants';
import { formatExecutivoDate } from '@/utils/executivoMappers';

interface AgendaPresencaCardProps {
  agendaPresenca: AgendaPresencaData;
}

export const AgendaPresencaCard = memo(function AgendaPresencaCard({ agendaPresenca }: AgendaPresencaCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" /> Agenda & Presença (No-Show)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Média Geral No-Show</p>
            <p className="text-2xl font-bold text-amber-600">{agendaPresenca.mediaNoShow.toFixed(1)}%</p>
          </div>
          <div className="p-4 bg-green-500/10 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Melhor Dia de Presença</p>
            <p className="text-lg font-bold text-green-600">
              {agendaPresenca.melhorDia ? formatExecutivoDate(agendaPresenca.melhorDia.data) : '-'}
            </p>
            {agendaPresenca.melhorDia && (
              <p className="text-xs text-muted-foreground">
                {agendaPresenca.melhorDia.compareceram}/{agendaPresenca.melhorDia.agendados} presentes
              </p>
            )}
          </div>
          <div className="p-4 bg-red-500/10 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Pior Dia de Presença</p>
            <p className="text-lg font-bold text-red-600">
              {agendaPresenca.piorDia ? formatExecutivoDate(agendaPresenca.piorDia.data) : '-'}
            </p>
            {agendaPresenca.piorDia && (
              <p className="text-xs text-muted-foreground">
                {agendaPresenca.piorDia.compareceram}/{agendaPresenca.piorDia.agendados} presentes
              </p>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="max-h-[300px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Experimental</TableHead>
                <TableHead className="text-center">Agendados</TableHead>
                <TableHead className="text-center">Compareceram</TableHead>
                <TableHead className="text-center">No-Show (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agendaPresenca.rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{formatExecutivoDate(row.data)}</TableCell>
                  <TableCell className="text-center">{row.agendados}</TableCell>
                  <TableCell className="text-center">{row.compareceram}</TableCell>
                  <TableCell className="text-center">
                    <span className={row.noShow > 30 ? 'text-red-600 font-medium' : row.noShow > 15 ? 'text-amber-600' : 'text-green-600'}>
                      {row.noShow.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {agendaPresenca.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum agendamento no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});
