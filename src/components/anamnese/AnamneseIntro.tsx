import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

interface AnamneseIntroProps {
  unidadeNome: string;
  onStart: () => void;
  onCancel: () => void;
}

export function AnamneseIntro({ unidadeNome, onStart, onCancel }: AnamneseIntroProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-anamnese-royal text-anamnese-royal-foreground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-10 safe-bottom">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-90">
          Iron Club · {unidadeNome}
        </p>

        <h1 className="font-display-condensed mt-10 text-[64px] font-black uppercase leading-[0.92] tracking-tight">
          Bem-vindo
          <br />
          à sua
          <br />
          experimental.
        </h1>

        <p className="mt-6 max-w-sm text-base leading-relaxed text-white/85">
          Antes de começar, vamos entender um pouco mais sobre você para personalizar sua aula.
        </p>

        <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/80">
          Leva menos de 2 minutos <Zap className="h-4 w-4 fill-white/90" />
        </p>

        <div className="mt-auto pb-6 pt-10">
          <Button
            onClick={onStart}
            size="lg"
            className="h-14 w-full rounded-2xl bg-white text-base font-bold uppercase tracking-wide text-anamnese-royal shadow-xl hover:bg-white/95"
          >
            Começar
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 block w-full text-center text-sm text-white/70 underline-offset-4 hover:underline"
          >
            Voltar para o lead
          </button>
        </div>
      </div>
    </div>
  );
}
