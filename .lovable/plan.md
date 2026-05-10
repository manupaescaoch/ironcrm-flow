## Objetivo

Cada um dos 4 formulários de encerramento envia o resumo da resposta para um grupo de WhatsApp diferente, de acordo com a unidade selecionada (Zona Norte ou Zona Sul). Os IDs dos grupos serão configuráveis em uma tela de admin (sem precisar usar secrets).

## Formulários cobertos

1. Estagiário Líder (`encerramento_turno_respostas`)
2. Coordenador de Unidade (`encerramento_coordenador_respostas`)
3. Coordenador de Horário (`encerramento_horario_respostas`)
4. Relatório Diário Comercial (`relatorio_diario_comercial_respostas`)

## 1. Banco de dados

Nova tabela `formulario_grupos_whatsapp`:
- `formulario_key` (text) — identificador fixo: `estagiario_lider`, `coordenador_unidade`, `coordenador_horario`, `relatorio_comercial`
- `unidade` (text) — `ZONA NORTE` ou `ZONA SUL`
- `grupo_id` (text) — ID do grupo Z-API (ex.: `120363...@g.us`)
- `grupo_nome` (text, opcional) — rótulo amigável
- `ativo` (boolean, default true)
- Índice único em `(formulario_key, unidade)`
- RLS: só admin lê/edita; ninguém mais.

## 2. Edge function `notify-formulario-encerramento`

Recebe `{ formulario_key, unidade, titulo, resumo }`:
1. Busca `grupo_id` na tabela acima usando `formulario_key + unidade`.
2. Se encontrar e estiver ativo, dispara mensagem via Z-API (`/send-text`) usando `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` (já existem).
3. Mensagem formatada com cabeçalho do formulário + resumo dos campos preenchidos.
4. CORS habilitado, sem `verify_jwt` (chamada anônima após submissão pública).

## 3. Frontend — submissão dos formulários

Em cada uma das 4 páginas (`EncerramentoTurno`, `EncerramentoCoordenador`, `EncerramentoHorario`, `RelatorioDiarioComercial`), após o `insert` bem-sucedido:
- Construir um `resumo` em texto (mesmo conteúdo da tela de "Resumo" já existente — só os campos preenchidos).
- Chamar `supabase.functions.invoke('notify-formulario-encerramento', { body: { formulario_key, unidade, titulo, resumo } })`.
- Falha no envio não bloqueia o sucesso da submissão (apenas log).

## 4. Tela de admin

Nova página `/configuracoes/grupos-whatsapp` (admin only), também acessível via aba/seção em **Operacional → Formulários**.

Layout: tabela 4×2 (4 formulários × 2 unidades), com input para o ID do grupo e switch de ativo. Inclui:
- Botão "Listar grupos" que reaproveita a edge function existente `list-whatsapp-groups` para ajudar a copiar o ID correto.
- Botão "Testar envio" por linha — chama a edge function com um resumo de teste para validar.
- Salvamento via `upsert` na tabela `formulario_grupos_whatsapp`.

## 5. Card no Operacional

Adicionar atalho discreto no topo da aba Formulários: "Configurar grupos WhatsApp" → abre a tela de admin (visível apenas para admin).

## Detalhes técnicos

- Padrão Z-API segue `notify-anamnese-experimental` (mesmas envs).
- `formulario_key` é constante hard-coded em cada página, não vem do banco.
- A edge function não falha se o grupo não estiver configurado — apenas retorna `{ skipped: true }`.
- Mensagem inclui data/hora local, nome do respondente, unidade e bullet list dos campos.

## Arquivos afetados

- Migração: nova tabela + RLS.
- `supabase/functions/notify-formulario-encerramento/index.ts` (novo).
- `src/pages/EncerramentoTurno.tsx`, `EncerramentoCoordenador.tsx`, `EncerramentoHorario.tsx`, `RelatorioDiarioComercial.tsx` — chamada à edge function no submit.
- `src/pages/admin/GruposWhatsApp.tsx` (novo) + rota em `App.tsx`.
- `src/components/cronograma/FormulariosList.tsx` — link "Configurar grupos" para admin.
