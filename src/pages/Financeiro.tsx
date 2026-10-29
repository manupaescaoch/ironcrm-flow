import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { perfilFolhaPermitido } from "@/lib/folha/acesso";

/**
 * Agrupador de navegação. Contas a Pagar e Folha são módulos independentes:
 * cada um mantém suas próprias permissões e nenhum dado passa de um para o outro.
 */
export default function Financeiro() {
  const { unidadeAtual } = useUnidade();
  const { userRole } = useAuth();
  const [veFolha, setVeFolha] = useState(false);

  useEffect(() => {
    let active = true;
    setVeFolha(false);
    if (!unidadeAtual?.id || !perfilFolhaPermitido(userRole)) return;
    (supabase as any).rpc("folha_minhas_permissoes", { _unidade_id: unidadeAtual.id })
      .then(({ data, error }: any) => { if (active) setVeFolha(!error && Array.isArray(data) && data.includes("ver")); });
    return () => { active = false; };
  }, [unidadeAtual?.id, userRole]);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <Link to="/contas-pagar">
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" />Contas a Pagar</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Boletos, vencimentos, baixas e conciliação.</CardContent>
            </Card>
          </Link>
          {perfilFolhaPermitido(userRole) && veFolha && (
            <Link to="/folha">
              <Card className="hover:border-primary transition-colors h-full">
                <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Folha e Pagamentos</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">Cálculo, conferência, fechamento e lote PIX para a Clara.</CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </Layout>
  );
}
