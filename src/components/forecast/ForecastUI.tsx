import { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BADGE_SINAL, CLASSES_SINAL, StatusSinal } from '@/lib/forecast';

export const TOOLTIPS: Record<string, string> = {
  cpl: 'Quanto custa gerar um lead efetivamente cadastrado no CRM.',
  cac: 'Quanto foi investido em mídia para gerar cada nova matrícula originada pelo tráfego.',
  comparecimento: 'Percentual dos experimentais marcados que realmente compareceram.',
  expMat: 'Percentual dos alunos que compareceram ao experimental e realizaram matrícula.',
  crescimento: 'Matrículas menos evasões no período.',
  evasao: 'Percentual da base de alunos perdida no período.',
  custoConversa: 'Quanto custa cada conversa iniciada no WhatsApp a partir do tráfego.',
  aproveitamento: 'Percentual das conversas iniciadas que viraram leads cadastrados no CRM.',
  leadExp: 'Percentual dos leads cadastrados que agendaram uma aula experimental.',
  ocupacao: 'Alunos ativos divididos pela capacidade máxima da unidade.',
  receita: 'Alunos ativos multiplicados pela mensalidade média.',
  base: 'Alunos ativos no início do período.',
};

export function InfoDica({ texto }: { texto: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex text-muted-foreground/70 hover:text-foreground">
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-xs leading-snug">{texto}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('border-border/70', className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  dica,
  status = 'neutro',
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  dica?: string;
  status?: StatusSinal;
  icon?: ReactNode;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            {label}
            {dica && <InfoDica texto={dica} />}
          </p>
          {icon}
        </div>
        <p className={cn('text-2xl font-bold mt-1.5 tabular-nums', CLASSES_SINAL[status])}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function LinhaIndicador({
  label,
  value,
  dica,
  status = 'neutro',
  fonte,
}: {
  label: string;
  value: string;
  dica?: string;
  status?: StatusSinal;
  fonte?: 'auto' | 'manual';
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        {label}
        {dica && <InfoDica texto={dica} />}
        {fonte && (
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] px-1 py-0 uppercase tracking-wider',
              fonte === 'auto'
                ? 'border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10'
                : 'border-violet-500/30 text-violet-600 dark:text-violet-400 bg-violet-500/10',
            )}
          >
            {fonte === 'auto' ? 'Auto' : 'Manual'}
          </Badge>
        )}
      </span>
      <span className={cn('text-sm font-semibold tabular-nums', CLASSES_SINAL[status])}>{value}</span>
    </div>
  );
}

export function SinalBadge({ status, children }: { status: StatusSinal; children: ReactNode }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', BADGE_SINAL[status])}>
      {children}
    </Badge>
  );
}

export function BarraProgresso({ valor, max }: { valor: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0;
  const cor = pct >= 100 ? 'bg-red-500' : pct >= 90 ? 'bg-amber-500' : pct >= 80 ? 'bg-amber-400' : 'bg-primary';
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', cor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}
