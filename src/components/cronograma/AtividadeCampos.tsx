import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORIDADE_DOT, PRIORIDADE_LABEL } from '@/components/ops/OpsTarefaItem';
import { cn } from '@/lib/utils';

/** Mesmas prioridades usadas em Gestão do dia / EVO OPS */
export const PRIORIDADE_OPTIONS = ['baixa', 'normal', 'alta', 'critica'] as const;

/** Setores já existentes no sistema (espelham cronograma_funcionarios.setor) */
export const SETOR_OPTIONS = ['treinador', 'recepção', 'comercial'] as const;

export const SEM_SETOR = '__sem_setor__';
export const MANTER_ATUAL = '__manter__';

export function setorLabel(setor: string) {
  return setor.charAt(0).toUpperCase() + setor.slice(1);
}

export function prioridadeLabel(prioridade?: string | null) {
  return PRIORIDADE_LABEL[prioridade || 'normal'] || 'Normal';
}

export function PrioridadeDot({ prioridade, className }: { prioridade?: string | null; className?: string }) {
  return (
    <span
      className={cn('h-2 w-2 rounded-full shrink-0', PRIORIDADE_DOT[prioridade || 'normal'] || PRIORIDADE_DOT.normal, className)}
    />
  );
}

export function PrioridadeSelect({
  value,
  onValueChange,
  allowKeep,
}: {
  value: string;
  onValueChange: (v: string) => void;
  allowKeep?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger><SelectValue placeholder={allowKeep ? 'Manter atual' : 'Normal'} /></SelectTrigger>
      <SelectContent>
        {allowKeep && <SelectItem value={MANTER_ATUAL}>Manter atual</SelectItem>}
        {PRIORIDADE_OPTIONS.map((p) => (
          <SelectItem key={p} value={p}>
            <span className="flex items-center gap-2">
              <PrioridadeDot prioridade={p} />
              {PRIORIDADE_LABEL[p]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SetorSelect({
  value,
  onValueChange,
  allowKeep,
}: {
  value: string;
  onValueChange: (v: string) => void;
  allowKeep?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger><SelectValue placeholder={allowKeep ? 'Manter atual' : 'Toda a unidade'} /></SelectTrigger>
      <SelectContent>
        {allowKeep && <SelectItem value={MANTER_ATUAL}>Manter atual</SelectItem>}
        <SelectItem value={SEM_SETOR}>Toda a unidade (sem setor)</SelectItem>
        {SETOR_OPTIONS.map((s) => (
          <SelectItem key={s} value={s}>{setorLabel(s)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
