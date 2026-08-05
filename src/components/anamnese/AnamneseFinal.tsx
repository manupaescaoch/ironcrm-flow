import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface AnamneseFinalProps {
  onSave: () => void;
  saving: boolean;
}

export function AnamneseFinal({ onSave, saving }: AnamneseFinalProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-anamnese-royal text-anamnese-royal-foreground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-12 safe-bottom">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
          <CheckCircle2 className="h-9 w-9" strokeWidth={2.5} />
        </div>

        <h1 className="font-display-condensed mt-10 text-[60px] font-black uppercase leading-[0.92] tracking-tight">
          Anamnese
          <br />
          finalizada.
        </h1>

        <p className="mt-6 max-w-sm text-base leading-relaxed text-white/85">
          Agora a equipe da EVO já tem as informações necessárias para conduzir sua aula com mais
          cuidado e personalização.
        </p>

        <div className="mt-auto pb-6 pt-10">
          <Button
            onClick={onSave}
            disabled={saving}
            size="lg"
            className="h-14 w-full rounded-2xl bg-white text-base font-bold uppercase tracking-wide text-anamnese-royal shadow-xl hover:bg-white/95"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar anamnese'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
