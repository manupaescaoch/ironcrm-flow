import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'recepcao' | 'comercial' | 'coordenador' | 'gerente';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: UserRole | null;
  userName: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isCoordenador: boolean;
  canAccessExecutivo: boolean;
  canAccessComissoes: boolean;
  canAccessRelatorio: boolean;
  canAccessAdminUsers: boolean;
  canEditLead: (leadCreatedBy: string | null) => boolean;
  canEditEscala: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  const fetchUserRole = async (userId: string): Promise<UserRole | null> => {
    try {
      // Fetch role directly from user_roles table
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      if (!data) return null;

      // Convert app_role to display role
      if (data.role === 'admin') return 'admin';
      if (data.role === 'moderator') return 'recepcao';
      if (data.role === 'user') return 'comercial';
      if (data.role === 'coordenador') return 'coordenador';
      if (data.role === 'gerente') return 'gerente';
      
      return null;
    } catch (err) {
      console.error('Error in fetchUserRole:', err);
      return null;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id).then(role => {
              setUserRole(role);
              setLoading(false);
            });
          }, 0);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id).then(role => {
          setUserRole(role);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Permission helpers
  const isAdmin = userRole === 'admin';
  const isCoordenador = userRole === 'coordenador' || userRole === 'gerente';
  const canAccessExecutivo = userRole === 'admin' || userRole === 'coordenador' || userRole === 'gerente';
  const canAccessComissoes = !!userRole;
  const canAccessRelatorio = userRole === 'admin' || userRole === 'coordenador' || userRole === 'gerente';
  const canAccessAdminUsers = userRole === 'admin';
  const canEditEscala = !!userRole;

  // Qualquer usuário autenticado pode editar/excluir leads da(s) unidade(s) a que tem acesso
  // (o isolamento por unidade é garantido no banco via RLS).
  const canEditLead = (_leadCreatedBy: string | null): boolean => {
    return !!user;
  };


  // Get user display name from email
  const userName = user?.email?.split('@')[0] || null;

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      userRole,
      userName,
      signIn, 
      signUp, 
      signOut,
      isAdmin,
      isCoordenador,
      canAccessExecutivo,
      canAccessComissoes,
      canAccessRelatorio,
      canAccessAdminUsers,
      canEditLead,
      canEditEscala
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
