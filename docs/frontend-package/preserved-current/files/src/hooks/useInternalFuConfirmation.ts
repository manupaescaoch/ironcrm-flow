import { useRef, useState } from 'react';
import { useUnidade } from '@/contexts/UnidadeContext';
import { createInternalConfirmation, invokeConfirmation } from '@/lib/fuConfirmationClient';
import type { FuTaskItem } from '@/lib/fuTaskState';

const confirmInternal = createInternalConfirmation(invokeConfirmation);
export function useInternalFuConfirmation(refetch: () => void) {
  const { unidadeAtual } = useUnidade();
  const currentUnit = useRef(unidadeAtual?.id); currentUnit.current = unidadeAtual?.id;
  const currentSelection = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return {
    saving, error,
    select: (id: string | null) => { currentSelection.current = id; setError(null); },
    confirm: async (item: FuTaskItem) => {
      if (item.unitId !== currentUnit.current || currentSelection.current !== item.id) throw new Error('A seleção mudou. Selecione novamente o aluno.');
      setSaving(true); setError(null);
      try {
        const result = await confirmInternal(item);
        if (item.unitId !== currentUnit.current || currentSelection.current !== item.id) return null;
        window.dispatchEvent(new CustomEvent('fu-confirmation-changed', { detail: { unitId: item.unitId } }));
        refetch();
        return result;
      } catch (cause) {
        if (item.unitId === currentUnit.current && currentSelection.current === item.id) setError(cause instanceof Error ? cause.message : 'Confirmação não verificada. Consulte o estado antes de tentar novamente.');
        refetch();
        return null;
      } finally { setSaving(false); }
    },
  };
}