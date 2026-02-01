import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';

export interface UnidadeUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Hook to fetch users that belong to the current unit
 * Uses user_unidades table to get user_ids, then fetches names via edge function
 */
export function useUnidadeUsers() {
  const [users, setUsers] = useState<UnidadeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { unidadeAtual } = useUnidade();

  const fetchUsers = useCallback(async () => {
    if (!unidadeAtual) {
      setUsers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get user IDs associated with this unit
      const { data: userUnidades, error: unidadesError } = await supabase
        .from('user_unidades')
        .select('user_id')
        .eq('unidade_id', unidadeAtual.id);

      if (unidadesError) {
        throw unidadesError;
      }

      if (!userUnidades || userUnidades.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Get session for auth
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session?.access_token) {
        // Fallback: try to list users anyway (admin only)
        setUsers([]);
        setLoading(false);
        return;
      }

      // Call list-users edge function to get user details
      const { data, error: fnError } = await supabase.functions.invoke('list-users', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (fnError || data?.error) {
        // If not admin, just use empty list - users can type manually
        console.log('Could not fetch users list (admin only):', fnError || data?.error);
        setUsers([]);
        setLoading(false);
        return;
      }

      // Filter to only users in this unit
      const userIds = new Set(userUnidades.map(uu => uu.user_id));
      const filteredUsers: UnidadeUser[] = (data?.users || [])
        .filter((u: any) => userIds.has(u.id))
        .map((u: any) => ({
          id: u.id,
          name: u.name || u.email?.split('@')[0] || 'Usuário',
          email: u.email || '',
        }));

      setUsers(filteredUsers);
    } catch (err: any) {
      console.error('Error fetching unit users:', err);
      setError(err.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
  };
}
