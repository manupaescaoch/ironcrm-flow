## Objetivo
Adicionar um campo "Status da taxa da aula experimental" ao CRM, com três opções (Pago antecipadamente, Pendente de pagamento, Isento da taxa), visível no cadastro do lead e no agendamento da experimental, editável manualmente.

## Alterações

### 1. Banco de dados
- Nova coluna em `leads`:
  - `status_taxa_experimental TEXT` (nullable, sem default) com trigger de validação aceitando apenas: `pago_antecipado`, `pendente`, `isento`.
- Sem alteração em `interacoes` — o status é uma propriedade do lead/experimental e é lido/atualizado pelo mesmo campo tanto no cadastro quanto no agendamento.

### 2. Tipos
- Adicionar `StatusTaxaExperimental` em `src/types/database.ts` e o campo opcional em `Lead`.
- Atualizar `mapToLead` em `src/utils/dashboardMappers.ts`.

### 3. UI — Cadastro do lead (CRM)
- No formulário de novo/editar lead em `src/pages/CRM.tsx` (e `LeadDetail.tsx` se houver edição inline), adicionar um `Select` "Status da taxa da experimental" com as 3 opções + "Não informado".
- Persistir no insert/update do lead.

### 4. UI — Agendamento da experimental
- No modal/seção de agendar experimental (dentro de `LeadDetail.tsx` / componente de interação), incluir o mesmo `Select`, pré-carregado com o valor atual do lead. Salvar atualiza `leads.status_taxa_experimental`.

### 5. Exibição
- Badge compacto no card do lead no CRM e na seção "Eventos de Hoje" do dashboard mostrando o status (cores: verde=pago, âmbar=pendente, cinza=isento). Sem badge quando nulo.

## Detalhes técnicos
- Valores internos em snake_case; labels em português nas telas.
- Nenhuma regra automática de comissão/financeiro é criada agora — apenas registro manual.
- RLS existente de `leads` já cobre o novo campo; nenhuma policy nova necessária.

## Fora do escopo
- Integração com módulo financeiro/comissões.
- Histórico de mudanças do status (pode ser adicionado depois se necessário).
