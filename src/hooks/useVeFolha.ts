import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { perfilFolhaPermitido } from "@/lib/folha/acesso";

/** Indica se o usuário pode ver a Folha na unidade atual (validado no servidor). */
export function useVeFolha() {
  const { unidadeAtual } = useUnidade();
  const { userRole } = useAuth();
  const [veFolha, setVeFolha] = useState(false);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let active = true;
    setVeFolha(false);
    setCarregado(false);
    if (!unidadeAtual?.id || !perfilFolhaPermitido(userRole)) {
      setCarregado(!!userRole);
      return;
    }
    (supabase as any)
      .rpc("folha_minhas_permissoes", { _unidade_id: unidadeAtual.id })
      .then(({ data, error }: any) => {
        if (!active) return;
        setVeFolha(!error && Array.isArray(data) && data.includes("ver"));
        setCarregado(true);
      });
    return () => { active = false; };
  }, [unidadeAtual?.id, userRole]);

  return { veFolha, carregado };
}
