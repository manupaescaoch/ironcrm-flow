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

export interface AdminNote {
  id: string;
  profile_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [adminNote, setAdminNote] = useState<AdminNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user, isAdmin, isCoordenador } = useAuth();
  const { toast } = useToast();

  const fetchProfileData = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setAdminNote(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch public profile
      const { data: profileData, error: profileErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;
      setProfile(profileData);

      // Fetch admin note if authorized
      if (isAdmin || isCoordenador) {
        const { data: noteData, error: noteErr } = await supabase
          .from('profile_admin_notes')
          .select('*')
          .eq('profile_id', user.id)
          .maybeSingle();
          
        if (!noteErr) {
          setAdminNote(noteData);
        }
      }
    } catch (err: any) {
      console.error('Error fetching profile data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAdmin, isCoordenador]);

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

  const updateAdminNote = useCallback(async (notes: string, targetProfileId?: string) => {
    const profileId = targetProfileId || user?.id;
    if (!profileId || !isAdmin) return;

    setSaving(true);
    try {
      const { data: existingNote } = await supabase
        .from('profile_admin_notes')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (existingNote) {
        const { error } = await supabase
          .from('profile_admin_notes')
          .update({ notes, created_by: user?.id })
          .eq('profile_id', profileId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profile_admin_notes')
          .insert({ profile_id: profileId, notes, created_by: user?.id });
        if (error) throw error;
      }

      if (profileId === user?.id) {
        await fetchProfileData();
      }

      toast({
        title: 'Nota salva',
        description: 'Nota administrativa atualizada com sucesso.',
      });
    } catch (err: any) {
      console.error('Error updating admin note:', err);
      toast({
        title: 'Erro ao salvar nota',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [user?.id, isAdmin, fetchProfileData, toast]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  return {
    profile,
    adminNote,
    loading,
    saving,
    updatePhone,
    updateAdminNote,
    refetch: fetchProfileData,
  };
}
