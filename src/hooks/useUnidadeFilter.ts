import { useCallback, useMemo } from 'react';
import { useUnidade } from '@/contexts/UnidadeContext';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/**
 * Hook to help with unidade filtering in queries
 */
export function useUnidadeFilter() {
  const { unidadeAtual, loading } = useUnidade();

  const unidadeId = useMemo(() => unidadeAtual?.id || null, [unidadeAtual]);

  /**
   * Filter a Supabase query by unidade_id
   */
  const filterByUnidade = useCallback(<T extends { eq: (column: string, value: string) => T }>(
    query: T
  ): T => {
    if (unidadeId) {
      return query.eq('unidade_id', unidadeId);
    }
    return query;
  }, [unidadeId]);

  /**
   * Add unidade_id to insert data
   */
  const addUnidadeId = useCallback(<T extends Record<string, unknown>>(data: T): T & { unidade_id: string } => {
    if (!unidadeId) {
      throw new Error('Nenhuma unidade selecionada');
    }
    return { ...data, unidade_id: unidadeId };
  }, [unidadeId]);

  /**
   * Check if we have a valid unidade selected
   */
  const hasUnidade = !!unidadeId;

  return {
    unidadeId,
    unidadeAtual,
    loading,
    filterByUnidade,
    addUnidadeId,
    hasUnidade,
  };
}
