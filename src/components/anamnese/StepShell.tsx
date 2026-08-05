import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft } from 'lucide-react';

interface StepShellProps {
  stepNumber: number;
  totalSteps: number;
  categoria: string;
  pergunta: string;
  apoio?: string;
  canContinue: boolean;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  children: ReactNode;
}

export function StepShell({
  stepNumber,
  totalSteps,
  categoria,
  pergunta,
  apoio,
  canContinue,
  onBack,
  onContinue,
  continueLabel = 'Continuar',
  children,
}: StepShellProps) {
  const progress = (stepNumber / totalSteps) * 100;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-anamnese-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-anamnese-royal text-anamnese-royal-foreground">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <span className="font-display-condensed text-lg font-extrabold uppercase tracking-wider">
            EVO TRAINING CLUB
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
            {stepNumber} de {totalSteps}
          </span>
        </div>
        <Progress
          value={progress}
          className="h-1 rounded-none bg-anamnese-royal-dark [&>div]:bg-white"
        />
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-44 pt-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-anamnese-category">
          {categoria}
        </p>
        <h2 className="mt-2 text-[26px] font-bold leading-[1.15] text-anamnese-card-foreground">
          {pergunta}
        </h2>
        {apoio && (
          <p className="mt-2 text-[15px] leading-snug text-anamnese-muted-foreground">{apoio}</p>
        )}

        <div className="mt-6 space-y-3">{children}</div>
      </main>

      {/* Bottom action area */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-anamnese-border bg-anamnese-card/95 backdrop-blur safe-bottom">
        <div className="mx-auto flex max-w-md flex-col gap-1 px-5 pt-3">
          <Button
            type="button"
            size="lg"
            disabled={!canContinue}
            onClick={onContinue}
            className="h-14 w-full rounded-2xl bg-anamnese-royal text-base font-semibold text-anamnese-royal-foreground shadow-md hover:bg-anamnese-royal-dark disabled:bg-anamnese-royal/40 disabled:text-white/80"
          >
            {continueLabel}
          </Button>
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="h-10 text-anamnese-muted-foreground hover:bg-transparent hover:text-anamnese-card-foreground"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
          )}
          {!onBack && <div className="h-2" />}
        </div>
      </footer>
    </div>
  );
}
