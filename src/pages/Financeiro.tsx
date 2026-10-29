import { Navigate } from "react-router-dom";

/**
 * Rota de compatibilidade. Financeiro agora é um grupo no menu lateral;
 * /financeiro leva à primeira seção autorizada (Contas a Pagar, que tem
 * suas próprias permissões). Contas a Pagar e Folha seguem independentes.
 */
export default function Financeiro() {
  return <Navigate to="/contas-pagar" replace />;
}
