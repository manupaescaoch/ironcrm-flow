import React, { memo } from 'react';
import { 
  Users, 
  CalendarCheck, 
  UserCheck, 
  GraduationCap, 
  TrendingUp,
  DollarSign,
  Receipt,
  Gem,
  CircleDollarSign,
  BadgeDollarSign,
  Target,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { TopCards } from '@/components/executivo/constants';
import { cn } from '@/lib/utils';

interface ExecutivoKPIGridProps {
  topCards: TopCards;
  investimentoMarketing?: number;
}

const formatCurrency = (value: number) => {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCurrencyFull = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
}

const MetricCard = memo(function MetricCard({ title, value, icon: Icon, iconBg, iconColor, subtitle }: MetricCardProps) {
  return (
    <Card className="bg-card border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-lg font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

interface ConversionCardProps {
  fromLabel: string;
  toLabel: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const ConversionCard = memo(function ConversionCard({ fromLabel, toLabel, value, icon: Icon, iconBg, iconColor }: ConversionCardProps) {
  return (
    <Card className="bg-card border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{fromLabel}</span>
              <ArrowRight className="w-3 h-3" />
              <span>{toLabel}</span>
            </div>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export const ExecutivoKPIGrid = memo(function ExecutivoKPIGrid({ 
  topCards, 
  investimentoMarketing = 0 
}: ExecutivoKPIGridProps) {
  // Calculate CPL and CPA based on investment input
  const cpl = investimentoMarketing > 0 && topCards.leadsDoMes > 0 
    ? investimentoMarketing / topCards.leadsDoMes 
    : null;
    
  const cpa = investimentoMarketing > 0 && topCards.matriculas > 0 
    ? investimentoMarketing / topCards.matriculas 
    : null;

  return (
    <div className="space-y-4">
      {/* Row 1: Volume Metrics - 5 columns on large screens */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          title="Leads do Mês"
          value={topCards.leadsDoMes}
          icon={Users}
          iconBg="bg-blue-500/15"
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Agendamentos"
          value={topCards.agendamentos}
          icon={CalendarCheck}
          iconBg="bg-amber-500/15"
          iconColor="text-amber-500"
        />
        <MetricCard
          title="Comparecimentos"
          value={topCards.comparecimentos}
          icon={UserCheck}
          iconBg="bg-purple-500/15"
          iconColor="text-purple-500"
        />
        <MetricCard
          title="Matrículas"
          value={topCards.matriculas}
          icon={GraduationCap}
          iconBg="bg-green-500/15"
          iconColor="text-green-500"
        />
        <MetricCard
          title="Faturamento"
          value={formatCurrencyFull(topCards.faturamentoTotal)}
          icon={DollarSign}
          iconBg="bg-emerald-500/15"
          iconColor="text-emerald-500"
        />
      </div>

      {/* Row 2: Conversion & Cost Metrics - 6 columns on large screens */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <ConversionCard
          fromLabel="Lead"
          toLabel="Atend."
          value={`${topCards.taxaLeadAtendimento.toFixed(1)}%`}
          icon={TrendingUp}
          iconBg="bg-blue-500/15"
          iconColor="text-blue-500"
        />
        <ConversionCard
          fromLabel="Atend."
          toLabel="Aluno"
          value={`${topCards.taxaConversao.toFixed(1)}%`}
          icon={Target}
          iconBg="bg-cyan-500/15"
          iconColor="text-cyan-500"
        />
        <MetricCard
          title="CPL"
          value={cpl ? formatCurrency(cpl) : '-'}
          icon={CircleDollarSign}
          iconBg="bg-orange-500/15"
          iconColor="text-orange-500"
          subtitle={!cpl ? "Informe invest." : undefined}
        />
        <MetricCard
          title="CPA"
          value={cpa ? formatCurrency(cpa) : '-'}
          icon={BadgeDollarSign}
          iconBg="bg-red-500/15"
          iconColor="text-red-500"
          subtitle={!cpa ? "Informe invest." : undefined}
        />
        <MetricCard
          title="Ticket Médio"
          value={formatCurrency(topCards.ticketMedio)}
          icon={Receipt}
          iconBg="bg-teal-500/15"
          iconColor="text-teal-500"
        />
        <MetricCard
          title="LTV (8m)"
          value={formatCurrency(topCards.ltv)}
          icon={Gem}
          iconBg="bg-purple-500/15"
          iconColor="text-purple-500"
        />
      </div>
    </div>
  );
});
