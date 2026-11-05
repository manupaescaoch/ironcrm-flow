import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useUnidade } from '@/contexts/UnidadeContext';
import { confirmCommercial } from '@/lib/commercialFollowUpStore';

export function useCommercialConfirmation() {
  const { unidadeAtual } = useUnidade();
  const currentUnit = useRef(unidadeAtual?.id);
  currentUnit.current = unidadeAtual?.id;
  const selectionUnit = useRef(unidadeAtual?.id);
  useEffect(() => { selectionUnit.current = undefined; }, [unidadeAtual?.id]);
  return {
    select: () => { selectionUnit.current = currentUnit.current; },
    confirm: async (item: { id: string; lead_id: string; tipo: string }, responsible: string, description: string) => {
      const unitId = selectionUnit.current;
      if (!unitId || unitId !== currentUnit.current) throw new Error('A unidade mudou. Selecione novamente o follow-up.');
      const result = await confirmCommercial({ id: item.id, leadId: item.lead_id, unitId, stage: item.tipo }, responsible, description);
      if (unitId !== currentUnit.current) return false;
      if (result.historyPending) toast.warning('Confirmação gravada, mas o histórico não foi verificado. Não repita o envio.');
      else toast.success(result.alreadyConfirmed ? 'Este follow-up já estava confirmado.' : 'Confirmação gravada.');
      window.dispatchEvent(new CustomEvent('fu-confirmation-changed', { detail: { unitId } }));
      return true;
    },
  };
}