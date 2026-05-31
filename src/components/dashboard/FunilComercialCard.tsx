import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CalendarCheck, CheckCircle2, Award, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunilComercialCardProps {
  leads: number;
  agendamentos: number;
  comparecimentos: number;
  matriculas: number;
  conversaoMesmoDia?: number;
}

function Stage({
  icon: Icon,
  label,
  value,
  subtitle,
  colorClass,
  bgClass,
}: {
  icon: any;
  label: string;
  value: number;
  subtitle: string;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className={cn('rounded-xl p-3 flex-1 min-w-0', bgClass)}>
      <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
        <Icon className={cn('w-3.5 h-3.5 shrink-0', colorClass)} />
        <span className="text-[11px] font-medium text-muted-foreground truncate">{label}</span>
      </div>
      <p className="text-xl font-bold leading-none truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1 leading-tight line-clamp-2">{subtitle}</p>
    </div>
  );
}

function Conversion({ pct }: { pct: number }) {
  return (
    <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
      <span className="text-[10px] font-semibold text-foreground whitespace-nowrap">{pct}%</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
    </div>
  );
}

export const FunilComercialCard = memo(function FunilComercialCard({
  leads,
  agendamentos,
  comparecimentos,
  matriculas,
  conversaoMesmoDia = 0,
}: FunilComercialCardProps) {
  const convAgend = leads > 0 ? Math.round((agendamentos / leads) * 100) : 0;
  const convComp = agendamentos > 0 ? Math.round((comparecimentos / agendamentos) * 100) : 0;
  const convMatr = comparecimentos > 0 ? Math.round((matriculas / comparecimentos) * 100) : 0;
  const convGeral = leads > 0 ? Math.round((matriculas / leads) * 100) : 0;
  const convMesmoDia = comparecimentos > 0 ? Math.round((conversaoMesmoDia / comparecimentos) * 100) : 0;

  return (
    <Card className="rounded-2xl border shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Funil Comercial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-stretch gap-1">
          <Stage
            icon={Users}
            label="Leads"
            value={leads}
            subtitle="Todos os tempos"
            colorClass="text-blue-500"
            bgClass="bg-blue-50 dark:bg-blue-950/30"
          />
          <Conversion pct={convAgend} />
          <Stage
            icon={CalendarCheck}
            label="Agendamentos"
            value={agendamentos}
            subtitle="No período"
            colorClass="text-sky-500"
            bgClass="bg-sky-50 dark:bg-sky-950/30"
          />
          <Conversion pct={convComp} />
          <Stage
            icon={CheckCircle2}
            label="Comparecimentos"
            value={comparecimentos}
            subtitle="Compareceram"
            colorClass="text-emerald-500"
            bgClass="bg-emerald-50 dark:bg-emerald-950/30"
          />
          <Conversion pct={convMatr} />
          <Stage
            icon={Award}
            label="Matrículas"
            value={matriculas}
            subtitle="No período"
            colorClass="text-amber-500"
            bgClass="bg-amber-50 dark:bg-amber-950/30"
          />
        </div>
        <div className="rounded-lg bg-muted/40 px-4 py-2.5 text-sm">
          <span className="font-semibold">Taxa de conversão geral: {convGeral}%</span>
          <span className="text-muted-foreground ml-3">
            {leads} Leads → {matriculas} Matrículas
          </span>
        </div>
      </CardContent>
    </Card>
  );
});
