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
  ticketMedioMes?: number;
  matriculasMes?: number;
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
    <div className={cn('rounded-lg p-2 flex-1 min-w-0', bgClass)}>
      <div className="flex items-center gap-1 mb-1 min-w-0">
        <Icon className={cn('w-3 h-3 shrink-0', colorClass)} />
        <span className="text-[10px] font-medium text-muted-foreground truncate">{label}</span>
      </div>
      <p className="text-lg font-bold leading-none truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-1">{subtitle}</p>
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
      <CardHeader className="pb-1.5 pt-3 px-4">
        <CardTitle className="text-sm font-semibold">Funil Comercial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3 px-4">
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
        <div className="rounded-md bg-muted/40 px-3 py-1.5 text-xs">
          <span className="font-semibold">Taxa de conversão geral: {convGeral}%</span>
          <span className="text-muted-foreground ml-2">
            {leads} Leads → {matriculas} Matrículas
          </span>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-1.5 text-xs">
          <span className="font-semibold">Taxa no dia da experimental: {convMesmoDia}%</span>
          <span className="text-muted-foreground ml-2">
            {conversaoMesmoDia} de {comparecimentos} comparecimentos
          </span>
        </div>
        <div className="rounded-md bg-muted/40 px-3 py-1.5 text-xs">
          <span className="font-semibold">Ticket médio do mês: {ticketMedioFormatado}</span>
          <span className="text-muted-foreground ml-2">
            {matriculasMes} {matriculasMes === 1 ? 'matrícula fechada' : 'matrículas fechadas'} no mês
          </span>
        </div>
      </CardContent>
    </Card>
  );
});
