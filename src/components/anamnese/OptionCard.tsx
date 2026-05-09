import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface OptionCardProps {
  emoji: string;
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}

export function OptionCard({ emoji, label, hint, selected, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-4 rounded-2xl border-2 bg-anamnese-card p-4 text-left transition-all',
        'shadow-sm hover:shadow active:scale-[0.99]',
        selected
          ? 'border-anamnese-border-selected ring-4 ring-anamnese-border-selected/15'
          : 'border-anamnese-border',
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl transition-colors',
          selected ? 'bg-anamnese-royal/10' : 'bg-anamnese-emoji-bg',
        )}
        aria-hidden
      >
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-anamnese-card-foreground leading-tight">{label}</div>
        {hint && <div className="mt-0.5 text-sm text-anamnese-muted-foreground">{hint}</div>}
      </div>
      {selected && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-anamnese-royal text-anamnese-royal-foreground">
          <Check className="h-4 w-4" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}
