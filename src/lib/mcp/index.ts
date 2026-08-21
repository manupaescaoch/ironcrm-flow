import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listUnidades from "./tools/list-unidades";
import listLeads from "./tools/list-leads";
import getLead from "./tools/get-lead";
import createLead from "./tools/create-lead";
import listContasPagar from "./tools/list-contas-pagar";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "evo-club-crm",
  title: "EVO CLUB CRM",
  version: "0.1.0",
  instructions:
    "Ferramentas do EVO CLUB CRM (academias EVO). Comece por `list_unidades` para descobrir as unidades do usuário; use `list_leads` e `get_lead` para consultar o CRM, `create_lead` para cadastrar um novo lead e `list_contas_pagar` para o financeiro. Todos os dados são restritos às unidades do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listUnidades, listLeads, getLead, createLead, listContasPagar],
});
