## Agente de Atendimento — Nova página no CRM

Página completa para configurar, testar e acompanhar um agente SDR automatizado de WhatsApp, restrita a Admin e Comercial.

### 1. Banco de dados (migration)

Criar 3 tabelas com RLS restrita a `admin` e `comercial` (`user` no enum):

**`agentes_atendimento`** — configuração do agente (1 por unidade)
- `id`, `unidade_id`, `nome`, `descricao`, `prompt`, `mensagem_inicial`
- `mensagem_pos_solicitacao` (mensagem padrão editável)
- `status` (ativo/inativo), `canal` (whatsapp), `regras` (jsonb), `configuracao_experimental` (jsonb)
- `criado_por`, `atualizado_por`, timestamps

**`agente_atendimentos`** — histórico de leads atendidos
- `id`, `agente_id`, `lead_id`, `nome`, `telefone`, `canal`
- `status` (novo/em_atendimento/qualificado/experimental_solicitada/sem_resposta/finalizado)
- `objetivo`, `horario_treino`, `unidade_interesse`, `plano_indicado`
- `resumo_conversa`, `experimental_solicitada` (bool), `dia_experimental`, `horario_experimental`
- `primeira_interacao_at`, `ultima_interacao_at`, timestamps

**`agentes_atendimento_versoes`** — snapshots de prompt/regras a cada save
- `id`, `agente_id`, `prompt`, `mensagem_inicial`, `regras`, `configuracao_experimental`, `criado_por`, `created_at`

RLS: `SELECT/INSERT/UPDATE/DELETE` permitidos só quando `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'user')` (comercial). Sempre filtrando por `unidade_id` via `user_has_unidade_access`.

### 2. Rota e menu

- Nova rota `/agente-atendimento` em `App.tsx`, protegida com `ComercialOrAdminRoute` (novo wrapper que redireciona para `/dashboard` se não for admin/comercial; mostra "Você não tem permissão" antes do redirect quando acessado diretamente).
- Item de menu em `Layout.tsx` na seção **Automações** (criar se não existir), ícone `Bot`, visível apenas para admin/comercial.

### 3. Página `src/pages/AgenteAtendimento.tsx`

Layout em seções:

1. **Header** — título + subtítulo
2. **KPI grid** (6 cards) — atendidos hoje/semana/mês, qualificados, experimentais solicitadas, taxa de conversão
3. **Filtros** — período (Hoje/7d/30d/Custom), status, unidade, plano, canal
4. **Tabela "Atendimentos recentes"** — colunas conforme spec, ações Ver conversa / Abrir lead / Ver resumo (modal)
5. **Card de status do agente** — ativo/inativo, canal, última atualização, responsável, toggle ativar/desativar
6. **Configurações do agente** — Nome, Função, Mensagem inicial, Prompt (com contador 0/8000)
7. **Regras rápidas** — 9 checkboxes
8. **Agendamento da experimental** — campos obrigatórios + mensagem padrão editável
9. **Testar agente** — input + botão Enviar teste → chama edge function que usa Lovable AI Gateway (`google/gemini-2.5-flash`) com o prompt salvo; área de resposta + Limpar
10. **Histórico de versões** — lista com data/usuário/status + restaurar
11. **Botões principais** — Salvar / Testar / Ativar / Desativar (com validações)

### 4. Edge function

`supabase/functions/agente-atendimento-test/index.ts` — recebe `{ prompt, mensagem }`, chama Lovable AI Gateway (`LOVABLE_API_KEY`) e devolve resposta simulada do agente. Verify JWT ligado; valida role admin/comercial server-side.

### 5. Validações

- Ativar exige: nome + mensagem inicial + prompt preenchidos (alertas específicos por campo faltante).
- Save grava versão em `agentes_atendimento_versoes`.
- Auto-update de status no atendimento quando experimental for solicitada.

### 6. Componentes auxiliares

- `src/components/agente/AgenteKPIGrid.tsx`
- `src/components/agente/AtendimentosTable.tsx`
- `src/components/agente/AgenteConfigForm.tsx`
- `src/components/agente/TestarAgentePanel.tsx`
- `src/components/agente/HistoricoVersoes.tsx`
- `src/components/agente/ResumoConversaModal.tsx`
- Hook `src/hooks/useAgenteAtendimento.ts`

### Detalhes técnicos

- Permissões: `userRole === 'admin' || userRole === 'comercial'` (no `AuthContext`, comercial = `user` no enum).
- Filtro de unidade via `useUnidadeFilter` existente.
- Datas com `new Date(ano, mês-1, dia)` (sem timezone bugs).
- Inputs em uppercase exceto email/numéricos (padrão do projeto).
- Tokens semânticos do design system; sem cores hardcoded.
- Sem quebrar nada existente — só adições.

### Fora de escopo (não incluído nesta entrega)

- Integração real com WhatsApp/Z-API para o agente operar em produção (apenas estrutura + endpoint de teste).
- Webhook de entrada de mensagens reais — a tabela `agente_atendimentos` fica pronta para ser populada por integração futura.
