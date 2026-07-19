## Objetivo
Simplificar a tela de Cronograma de Automações agrupando por tipo de atividade e por horário, sem listar cada registro individualmente. Toda a variação de dias da semana passa a ser resolvida dentro do modal de edição.

## Agrupamento (nível 1 → nível 2)

Nível 1 — Tipo de atividade, sempre nesta ordem fixa:
1. Encerramento coordenador de turno
2. Relatório Diário Comercial
3. Grade do próximo horário
4. Encerramento Estagiário Líder

Nível 2 (dentro de cada tipo) — **agrupar por horário + responsável + unidade**, mostrando:
- Horário (ex.: 11:00)
- Responsável
- Unidade
- Dias ativos (chips: Dom Seg Ter Qua Qui Sex Sáb — marcados = ativos)
- Status (ativo/pausado agregado)
- Ações: Editar · Pausar/Ativar · Excluir

Cada linha do grupo representa **um conjunto** de registros que compartilham título+horário+responsável+unidade e diferem apenas no dia. A lista fica curta (dezenas em vez de centenas).

## Modal de edição (nova ordem de campos)

Conforme o anexo:
1. **Responsável** (select)
2. **Horário**
3. **Dias da semana** (chips multi-seleção Dom–Sáb + atalhos Seg–Sex / Fim de semana / Todos / Limpar)
4. **Ação WhatsApp**: Vincular Formulário | Escrever Mensagem (+ textarea)
5. Botões: Salvar Alterações · Excluir

Título deixa de ser editável no modal (é o próprio tipo do grupo) — permanece somente leitura no cabeçalho do modal.

## Comportamento ao salvar

Aplicar a mudança a **todos os registros do conjunto** (mesmo título+horário+responsável+unidade):
- Dias marcados que não existem → criar registro
- Dias desmarcados que existem → excluir (ou desativar se já houver histórico de envio)
- Horário / responsável / mensagem / formulário → atualizar em todos
- Se o horário mudar, o conjunto inteiro migra para o novo horário

Reaproveitar a RPC `admin_bulk_update_cronograma` já existente (operação `replace_dias` + updates de campos) para executar tudo em uma chamada e registrar no histórico.

## Escopo técnico

- `src/components/cronograma-admin/AtividadesPorTipo.tsx`
  - Fixar ordem dos 4 tipos no topo (esconder demais tipos desta tela ou mantê-los abaixo, colapsados — a definir; padrão do plano: mostrar apenas os 4)
  - Trocar a tabela atual por uma tabela agrupada por (horário, responsável, unidade) com coluna de dias como chips
  - Remover coluna "Turno" e "Dia" isolado
- `src/pages/admin/CronogramaAutomacoes.tsx` (`EditAtividadeDialog`)
  - Reordenar campos: Responsável → Horário → Dias → Ação WhatsApp
  - Remover campo Título editável (virar cabeçalho read-only)
  - Salvar via bulk update no conjunto inteiro
- Sem migração de banco; usa colunas e RPCs existentes.

## Perguntas rápidas (posso assumir defaults)

- Os outros tipos de atividade (fora dos 4) — **ocultar** desta tela (default) ou manter num acordeão "Outros" ao final?
- Se um conjunto tiver status misto (parte ativo, parte pausado), o toggle da linha deve **ativar todos** ao ligar e **pausar todos** ao desligar? (default: sim)
