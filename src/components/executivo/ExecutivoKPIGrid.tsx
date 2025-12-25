import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, CalendarCheck, UserCheck, GraduationCap, Percent } from 'lucide-react';
import { TopCards } from '@/components/executivo/constants';

interface ExecutivoKPIGridProps {
  topCards: TopCards;
}

export const ExecutivoKPIGrid = memo(function ExecutivoKPIGrid({ topCards }: ExecutivoKPIGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Leads do Mês</p>
              <p className="text-2xl font-bold">{topCards.leadsDoMes}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <CalendarCheck className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Agendamentos</p>
              <p className="text-2xl font-bold">{topCards.agendamentos}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <UserCheck className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Comparecimentos</p>
              <p className="text-2xl font-bold">{topCards.comparecimentos}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <GraduationCap className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Matrículas</p>
              <p className="text-2xl font-bold">{topCards.matriculas}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Percent className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taxa Conversão</p>
              <p className="text-2xl font-bold">{topCards.taxaConversao.toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
