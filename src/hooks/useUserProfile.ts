import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface UserProfile {
  id: string;
  user_id: string;
  telefone: string | null;
  created_at: string;
  updated_at: string;
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setProfile(data);
    } catch (err: any) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const updatePhone = useCallback(async (telefone: string) => {
    if (!user?.id) return;

    setSaving(true);
    try {
      if (profile) {
        // Update existing
        const { error } = await supabase
          .from('user_profiles')
          .update({ telefone })
          .eq('user_id', user.id);

        if (error) throw error;

        setProfile(prev => prev ? { ...prev, telefone } : null);
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('user_profiles')
          .insert({ user_id: user.id, telefone })
          .select()
          .single();

        if (error) throw error;

        setProfile(data);
      }

      toast({
        title: 'Telefone salvo',
        description: 'Seu telefone foi atualizado com sucesso.',
      });
    } catch (err: any) {
      console.error('Error updating phone:', err);
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [user?.id, profile, toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    saving,
    updatePhone,
    refetch: fetchProfile,
  };
}
