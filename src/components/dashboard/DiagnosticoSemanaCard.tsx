import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Lightbulb } from 'lucide-react';

interface DiagnosticoSemanaCardProps {
  leads: number;
  agendamentos: number;
  comparecimentos: number;
  matriculas: number;
}

export const DiagnosticoSemanaCard = memo(function DiagnosticoSemanaCard({
  leads,
  agendamentos,
  comparecimentos,
  matriculas,
}: DiagnosticoSemanaCardProps) {
  const taxaComp = agendamentos > 0 ? Math.round((comparecimentos / agendamentos) * 100) : 0;
  const taxaMatr = comparecimentos > 0 ? Math.round((matriculas / comparecimentos) * 100) : 0;

  let diagnostico = 'Acompanhe os indicadores e mantenha a equipe alinhada com as metas da semana.';
  if (leads > 0 && agendamentos / Math.max(leads, 1) < 0.5) {
    diagnostico = 'Geração de leads acima da capacidade de agendamento. Prioridade: aumentar conversão lead → agendamento.';
  } else if (taxaComp < 70 && agendamentos > 0) {
    diagnostico = 'Boa geração de leads, mas ainda há perda relevante entre agendamento e comparecimento. Prioridade: reforçar confirmação pré-aula e follow-up.';
  } else if (taxaMatr < 50 && comparecimentos > 0) {
    diagnostico = 'Comparecimento saudável, mas fechamento abaixo do esperado. Prioridade: treinar argumentação e oferta no pós-aula.';
  } else if (matriculas > 0) {
    diagnostico = 'Funil saudável em todas as etapas. Mantenha o ritmo de follow-ups para sustentar a conversão.';
  }

  return (
    <Card className="rounded-2xl border shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Diagnóstico da Semana</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-sky-500" />
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{diagnostico}</p>
        </div>
        <div className="flex gap-3 pt-1">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-medium">Dica estratégica</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Leads com primeiro contato em até 5 min convertem 2,3x mais.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
