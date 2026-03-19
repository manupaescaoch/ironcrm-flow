

## Reestruturar página Cronograma Operacional com 4 abas

Baseado nos screenshots de referência, a página `/cronograma` será reorganizada com 4 abas principais em vez das 3 atuais (Formulários, Envios, Relatório).

### Nova estrutura de abas

1. **Dashboard** (padrão ao entrar) — KPIs: mensagens enviadas, respondidas, não respondidas, taxa de resposta + performance (tempo médio de resposta, melhor/pior respondedor). Similar ao screenshot 1.
2. **Cronograma** — Atividades operacionais organizadas por horário com status, responsável e ações (similar à página Rotinas com calendário/lista). Reutiliza o padrão de `RotinasCalendario`.
3. **Funcionários** — Lista de funcionários da unidade com nome, telefone, setor, turno, KPIs individuais (formulários respondidos, taxa de resposta, tempo médio). Botão "Enviar Form". Similar aos screenshots 2 e 3.
4. **Formulários** — O builder e lista de formulários já existente + aba de automações. Similar ao screenshot 4.

### Banco de dados

Nova tabela `cronograma_funcionarios` para cadastro de funcionários operacionais vinculados à unidade:
- id, unidade_id, nome, telefone, setor, turno, ativo, created_at

Nova tabela `cronograma_atividades` para as atividades do cronograma (horário, responsável, status):
- id, unidade_id, formulario_id (nullable), titulo, horario, responsavel_id (ref cronograma_funcionarios), ativo, created_at

Nova tabela `cronograma_envios` para rastrear envios de formulários:
- id, atividade_id (nullable), formulario_id, funcionario_id, unidade_id, status (pendente/enviado/respondido), enviado_em, respondido_em, created_at

RLS: admin-only para CRUD, select por unidade.

### Arquivos novos/alterados

| Arquivo | Descrição |
|---|---|
| `src/pages/CronogramaOperacional.tsx` | **Alterar** — 4 abas: Dashboard, Cronograma, Funcionários, Formulários |
| `src/components/cronograma/CronogramaDashboard.tsx` | **Novo** — KPIs de envios/respostas + performance |
| `src/components/cronograma/CronogramaTab.tsx` | **Novo** — Atividades por horário com status e ações |
| `src/components/cronograma/FuncionariosTab.tsx` | **Novo** — Lista de funcionários com KPIs e ações |
| `src/components/cronograma/FuncionarioDetail.tsx` | **Novo** — Detalhe do funcionário com dashboard individual |
| `src/components/cronograma/FuncionarioForm.tsx` | **Novo** — Formulário de cadastro/edição de funcionário |
| `src/hooks/useCronogramaFuncionarios.ts` | **Novo** — CRUD para funcionários |
| `src/hooks/useCronogramaEnvios.ts` | **Novo** — Dados de envios e métricas |
| `src/components/cronograma/FormulariosList.tsx` | **Manter** — já existe, adaptações menores |
| `src/components/cronograma/FormularioBuilder.tsx` | **Manter** — já existe |
| `src/components/cronograma/RelatorioTab.tsx` | **Remover** — absorvido pelo Dashboard |
| `src/components/cronograma/EnviosTab.tsx` | **Remover** — absorvido pelo Dashboard e Cronograma |

### Implementação faseada

**Esta fase**: Criar as 3 tabelas, reestruturar a página com as 4 abas, implementar Dashboard com KPIs, Cronograma com lista de atividades, Funcionários com CRUD, e reorganizar Formulários.

**Fase seguinte**: Integração WhatsApp (envio de formulários via Z-API e respostas no grupo).

