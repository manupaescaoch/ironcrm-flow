import React, { memo } from 'react';
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
import { MESES, YEARS } from './constants';

interface ComissoesFiltersProps {
  mes: string;
  ano: string;
  filterFuncionario: string;
  onMesChange: (value: string) => void;
  onAnoChange: (value: string) => void;
  onFilterFuncionarioChange: (value: string) => void;
}

export const ComissoesFilters = memo(function ComissoesFilters({
  mes,
  ano,
  filterFuncionario,
  onMesChange,
  onAnoChange,
  onFilterFuncionarioChange,
}: ComissoesFiltersProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg">Filtros</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Mês</Label>
            <Select value={mes} onValueChange={onMesChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ano</Label>
            <Select value={ano} onValueChange={onAnoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ano" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
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
              onChange={(e) => onFilterFuncionarioChange(e.target.value)}
              placeholder="Filtrar por nome..."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
