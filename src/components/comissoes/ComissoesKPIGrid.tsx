import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingUp, Briefcase, UserCheck, Award, DollarSign } from 'lucide-react';
import { ComissaoStats, TreinadorStats } from './constants';
import { formatComissaoCurrency } from '@/utils/comissoesMappers';

interface ComissoesKPIGridProps {
  stats: ComissaoStats;
  treinadorStats: TreinadorStats;
  totalComissoes: number;
}

export const ComissoesKPIGrid = memo(function ComissoesKPIGrid({
  stats,
  treinadorStats,
  totalComissoes,
}: ComissoesKPIGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      <Card className="bg-card border shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Matrículas</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalMatriculas}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
              <p className="text-2xl font-bold text-foreground">{formatComissaoCurrency(stats.ticketMedio)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cadastrador (3%)</p>
              <p className="text-2xl font-bold text-green-600">{formatComissaoCurrency(stats.totalComissaoCadastrador)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fechador (2%)</p>
              <p className="text-2xl font-bold text-amber-600">{formatComissaoCurrency(stats.totalComissaoFechador)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Bônus Treinador</p>
              <p className="text-2xl font-bold text-blue-600">{formatComissaoCurrency(treinadorStats.totalBonus)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/10 border-primary/30 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/30 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Comissões</p>
              <p className="text-2xl font-bold text-primary">{formatComissaoCurrency(totalComissoes)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
