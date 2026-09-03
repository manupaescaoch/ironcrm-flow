import { useAuth } from '@/contexts/AuthContext';

/**
 * Rótulo do escopo amplo no EVO OPS.
 * Papéis de gestão (admin, gerente, coordenador) veem toda a unidade;
 * recepção/comercial veem apenas o próprio setor (restrição aplicada no banco via RLS).
 */
export function useOpsEscopoLabel(): string {
  const { userRole } = useAuth();
  const gestao = userRole === 'admin' || userRole === 'gerente' || userRole === 'coordenador';
  return gestao ? 'Toda a unidade' : 'Meu setor';
}
