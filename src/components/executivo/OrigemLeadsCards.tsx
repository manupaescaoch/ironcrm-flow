import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { OrigemItem, CHART_COLORS } from '@/components/executivo/constants';

interface OrigemLeadsCardsProps {
  origemData: OrigemItem[];
}

export const OrigemLeadsCards = memo(function OrigemLeadsCards({ origemData }: OrigemLeadsCardsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Leads por Origem</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={origemData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="origem" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="leads" fill="#3b82f6" name="Leads">
                  {origemData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversão por Origem</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-center">Matrículas</TableHead>
                <TableHead className="text-center">Conversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {origemData.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.origem}</TableCell>
                  <TableCell className="text-center">{item.leads}</TableCell>
                  <TableCell className="text-center">{item.matriculas}</TableCell>
                  <TableCell className="text-center">
                    <span className={item.conversao >= 30 ? 'text-green-600 font-medium' : ''}>
                      {item.conversao.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
});
