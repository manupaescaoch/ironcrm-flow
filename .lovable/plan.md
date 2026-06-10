## Objetivo
Disparar automaticamente 2 follow-ups pós-matrícula pelo número comercial, direto ao telefone do aluno:
- **M+7**: 7 dias após a matrícula
- **M+30**: 30 dias após a matrícula

Reaproveita a infraestrutura existente de `follow_ups` (mesma tabela, mesmo cron, mesmo log, mesmo chip comercial, mesma janela seg–sex 09h BRT).

## Mudanças

### 1. Banco (migração)
- Adicionar tipos `M+7` e `M+30` aceitos em `follow_ups.tipo` (a tabela aceita texto livre, mas precisamos garantir consistência — sem CHECK novo, apenas documentado).
- Criar trigger `generate_post_matricula_follow_ups` em `interacoes`: quando `fechou_matricula` muda para `true`, inserir 2 linhas em `follow_ups` (`M+7` e `M+30`) com `data_referencia = data da matrícula` e `data_prevista = +7 / +30 dias`, status `pendente`. ON CONFLICT DO NOTHING.
- Importante: o trigger existente `cancel_follow_ups_on_matricula` cancela TODOS os FU pendentes ao matricular — vamos ajustá-lo para cancelar apenas os tipos comerciais pré-matrícula (`D+1, D+7, D+15, D+30`), preservando os `M+*`.

### 2. Edge function `send-follow-ups-automaticos`
- Incluir `M+7` e `M+30` no filtro `.in('tipo', [...])`.
- Adicionar 2 templates em `TEMPLATES` com o texto exato fornecido pelo usuário (mantendo `{nome}` = primeiro nome).
- Manter regras de elegibilidade adaptadas para pós-matrícula:
  - Aluno precisa estar `ativo = true`.
  - `is_matriculado = true` (oposto da regra atual) — não cancelar por estar matriculado.
  - Cancelar se `ativo = false`.
- Como a função hoje cancela quando `is_matriculado` ou `status_funil = 'convertido'`, vamos diferenciar por prefixo do tipo: `D+*` mantém regra atual (cancelar matriculados), `M+*` exige matriculado e ativo.

### 3. Backfill (opcional, via insert)
Gerar `M+7`/`M+30` para matrículas recentes ainda dentro da janela (últimos 30 dias) para não perder ninguém. Pendente de confirmação se desejado.

## Templates (texto literal)

**M+7**
> Olá, {nome}! Tudo bem? 💙
> 
> Já faz alguns dias que você começou sua experiência com a gente na Iron, e queremos saber como está sendo para você até aqui.
> 
> Você conseguiu se adaptar bem aos agendamentos, à rotina de treino e ao acompanhamento da equipe?
> 
> Lembrando que, sempre que precisar, a recepção está à disposição por aqui para ajudar com dúvidas, avaliação física ou qualquer orientação sobre sua experiência na Iron.
> 
> Estamos felizes em ter você com a gente.

**M+30**
> Olá, {nome}! Tudo bem? 💙
> 
> Hoje você completa seu primeiro mês na Iron, e queremos saber como está sendo sua experiência com a nossa estrutura, os agendamentos, o acompanhamento dos treinadores e os benefícios inclusos no seu plano.
> 
> Esse também é um ótimo momento para fazer sua avaliação física mensal e ajustar o treino, caso necessário, de acordo com sua evolução e seus objetivos.
> 
> Se quiser, já posso te ajudar a agendar sua avaliação por aqui.

## Detalhes técnicos
- Canal: `comercial` (ZAPI_COMERCIAL_*).
- Cron pg_cron existente já roda `send-follow-ups-automaticos` em dias úteis 09h BRT — nenhuma mudança no cron.
- Logs em `whatsapp_envios_log` por `funcao = 'send-follow-ups-automaticos'`, canal `comercial`.
- Proteções existentes (rate limit, phone-exists, status check, claim atômico) aplicam-se automaticamente.
- Memória: atualizar `mem://features/follow-ups-automation` para refletir M+7/M+30.

## Pergunta antes de implementar
Quer que eu faça o **backfill** das matrículas dos últimos 30 dias (gerando M+7/M+30 retroativos para alunos matriculados recentemente)? Se sim, somente para a unidade atual ou todas?
