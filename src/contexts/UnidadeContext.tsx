import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Unidade {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
}

interface UnidadeContextType {
  unidades: Unidade[];
  unidadesPermitidas: Unidade[];
  unidadeAtual: Unidade | null;
  setUnidadeAtual: (unidade: Unidade) => void;
  loading: boolean;
  hasMultipleUnidades: boolean;
}

const UnidadeContext = createContext<UnidadeContextType | undefined>(undefined);

// Local storage key for persisting selected unit
const STORAGE_KEY = 'iron-crm-unidade-atual';

export function UnidadeProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading: authLoading, userRole } = useAuth();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadesPermitidas, setUnidadesPermitidas] = useState<Unidade[]>([]);
  const [unidadeAtual, setUnidadeAtualState] = useState<Unidade | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUnidades = useCallback(async () => {
    // Aguarda user e userRole estarem definidos
    if (!user || userRole === undefined) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all unidades
      const { data: todasUnidades, error: unidadesError } = await supabase
        .from('unidades')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (unidadesError) {
        console.error('Error fetching unidades:', unidadesError);
        setLoading(false);
        return;
      }

      setUnidades(todasUnidades || []);

      // If admin, has access to all units
      if (isAdmin) {
        setUnidadesPermitidas(todasUnidades || []);

        // Restore from localStorage or default to first unit (excluindo "Não definida")
        const savedUnidadeId = localStorage.getItem(STORAGE_KEY);
        const savedUnidade = todasUnidades?.find(u => u.id === savedUnidadeId);
        const NAO_DEFINIDA_ID = '00000000-0000-0000-0000-000000000000';
        const unidadesReais = (todasUnidades || []).filter(u => u.id !== NAO_DEFINIDA_ID);

        if (savedUnidade) {
          setUnidadeAtualState(savedUnidade);
        } else if (unidadesReais.length > 0) {
          setUnidadeAtualState(unidadesReais[0]);
        } else if (todasUnidades && todasUnidades.length > 0) {
          setUnidadeAtualState(todasUnidades[0]);
        }

        setLoading(false);
        return;
      }

      // For non-admin users, fetch their permitted units
      const { data: userUnidades, error: userUnidadesError } = await supabase
        .from('user_unidades')
        .select('unidade_id, is_default')
        .eq('user_id', user.id);

      if (userUnidadesError) {
        console.error('Error fetching user unidades:', userUnidadesError);
        setLoading(false);
        return;
      }

      // Filter unidades to only those the user has access to
      const unidadeIds = userUnidades?.map(uu => uu.unidade_id) || [];
      const permitidas = todasUnidades?.filter(u => unidadeIds.includes(u.id)) || [];
      setUnidadesPermitidas(permitidas);

      // Find default unit or use first permitted
      const defaultUserUnidade = userUnidades?.find(uu => uu.is_default);
      const defaultUnidade = defaultUserUnidade 
        ? permitidas.find(u => u.id === defaultUserUnidade.unidade_id)
        : permitidas[0];

      // Check localStorage first
      const savedUnidadeId = localStorage.getItem(STORAGE_KEY);
      const savedUnidade = permitidas.find(u => u.id === savedUnidadeId);
      
      if (savedUnidade) {
        setUnidadeAtualState(savedUnidade);
      } else if (defaultUnidade) {
        setUnidadeAtualState(defaultUnidade);
      }
    } catch (error) {
      console.error('Error in fetchUnidades:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, userRole]);

  useEffect(() => {
    // Só executa após auth terminar E userRole estar definido
    if (!authLoading && userRole !== undefined) {
      fetchUnidades();
    }
  }, [authLoading, userRole, fetchUnidades]);

  const setUnidadeAtual = useCallback((unidade: Unidade) => {
    setUnidadeAtualState(unidade);
    localStorage.setItem(STORAGE_KEY, unidade.id);
  }, []);

  const hasMultipleUnidades = unidadesPermitidas.length > 1;

  return (
    <UnidadeContext.Provider value={{
      unidades,
      unidadesPermitidas,
      unidadeAtual,
      setUnidadeAtual,
      loading,
      hasMultipleUnidades,
    }}>
      {children}
    </UnidadeContext.Provider>
  );
}

export function useUnidade() {
  const context = useContext(UnidadeContext);
  if (context === undefined) {
    throw new Error('useUnidade must be used within an UnidadeProvider');
  }
  return context;
}
