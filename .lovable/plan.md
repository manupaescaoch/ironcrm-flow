

## Nova página: Cronograma Operacional (Formulários + WhatsApp)

Página independente `/cronograma` acessível apenas por admin, com item no menu lateral na seção administrativa (após Estoque, antes de Executivo).

### Fase 1 — Banco de dados + CRUD de formulários

**3 tabelas novas (migration):**

- **`formularios`** — id, unidade_id, titulo, descricao, ativo, created_by, created_at, updated_at
- **`formulario_campos`** — id, formulario_id, tipo (texto/numero/sim_nao/foto/selecao), label, opcoes (jsonb), ordem, obrigatorio
- **`formulario_respostas`** — id, formulario_id, respondido_por_nome (text), respondido_por_telefone (text), respostas (jsonb), created_at, enviado_grupo (boolean default false)

RLS: admin-only para CRUD de formulários/campos; insert público (anon) para respostas; select por unidade para respostas.

**Novos arquivos:**

| Arquivo | Descrição |
|---|---|
| `src/pages/CronogramaOperacional.tsx` | Página principal com 3 sub-views via tabs: Formulários, Envios, Relatório |
| `src/components/cronograma/FormularioBuilder.tsx` | Criador/editor de formulários com campos dinâmicos |
| `src/components/cronograma/FormulariosList.tsx` | Lista de formulários com toggle ativo, ações (editar, excluir, enviar) |
| `src/components/cronograma/EnviosTab.tsx` | Histórico de envios com status (pendente/enviado/respondido) |
| `src/components/cronograma/RelatorioTab.tsx` | KPIs: enviados, respondidos, pendentes, taxa de resposta |
| `src/hooks/useFormulariosData.ts` | Hook CRUD para formulários, campos e respostas |

**Alterações existentes:**

- `src/components/Layout.tsx` — adicionar item "Cronograma" com ícone `FileCheck` na seção admin (entre Estoque e Executivo)
- `src/App.tsx` — nova rota `/cronograma` protegida por `AdminRoute`

### Fase 2 — Página pública + envio WhatsApp

| Arquivo | Descrição |
|---|---|
| `src/pages/FormularioPublico.tsx` | Página pública `/formulario/:id` (sem auth) para preenchimento pelo celular |
| `supabase/functions/enviar-formulario-whatsapp/index.ts` | Envia link do formulário via Z-API para o responsável |

- Rota pública no App.tsx (sem ProtectedRoute)
- Formulário renderiza campos dinâmicos, salva respostas no banco

### Fase 3 — Notificação no grupo + relatório

| Arquivo | Descrição |
|---|---|
| `supabase/functions/formulario-resposta-grupo/index.ts` | Ao receber resposta, formata resumo e envia no grupo WhatsApp via Z-API |
| `src/components/cronograma/RelatorioTab.tsx` | Dashboard com KPIs e filtros por data |

### Seção técnica

- `verify_jwt = false` para `formulario-resposta-grupo` (webhook) e para `enviar-formulario-whatsapp` (chamado pelo frontend autenticado via `supabase.functions.invoke`)
- Secrets Z-API já configurados (ZAPI_INSTANCE_ID, ZAPI_CLIENT_TOKEN, ZAPI_TOKEN)
- Storage bucket `rotinas-comprovantes` reutilizado para fotos dos formulários
- RLS de `formulario_respostas` precisa de policy anon para INSERT (página pública)

Vamos começar pela Fase 1?

