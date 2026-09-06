# Encerramento Técnico Diário — Coordenador Geral Técnico

Novo formulário fixo, no mesmo padrão dos encerramentos que já existem: link próprio, preenchimento em passos rápidos, rascunho salvo automaticamente, resumo antes de enviar e envio do resumo completo para um grupo de WhatsApp por unidade.

## Onde aparece

- Cartão fixo na aba **Formulários** (dentro de Operacional), logo abaixo dos outros encerramentos, com "Copiar link" e "Abrir".
- Link: `/encerramento-tecnico`, aberto (sem login), como os demais.
- Em **Admin → Grupos por Formulário** entra a nova linha "Encerramento Técnico Diário" com as três unidades (Madalena, Boa Viagem, Setúbal) para você colar os IDs dos grupos.

## Como será o preenchimento

Passo a passo em tela cheia, um bloco por vez, com botões grandes e o mínimo de digitação:

1. **Identificação** — unidade (Madalena / Boa Viagem / Setúbal), nome do Coordenador Geral Técnico, data já preenchida com hoje e editável.
2. **Alinhamento dos turnos** — manhã e noite (Sim/Não; se "Não", motivo obrigatório) e os pontos alinhados em múltipla escolha. "Nenhuma pendência" desmarca as outras e vice-versa; qualquer outra opção abre um único campo de detalhamento.
3. **Supervisão técnica** — ronda (integral / parcial / não, com motivo quando não for integral); desvios técnicos, feedbacks corretivos e destaques positivos, cada um como lista em que se pode adicionar e remover registros. Em desvio "Pendente", responsável e prazo passam a ser obrigatórios. Destaque positivo recusa respostas genéricas ("todos", "equipe toda", "tudo certo", "muito bom") e pede profissional + conduta.
4. **Equipe e operação** — escala cumprida (se não, lista de ocorrências com tipo, cobertura, responsável só quando houver cobertura, e impacto); distribuição dos alunos; alunos atendidos na tarde; lista de atendimentos por treinador; experimentais agendadas / realizadas / ausentes, com bloqueio quando realizadas + ausentes passarem das agendadas.
5. **Experiência do aluno** — ocorrências com aluno em lista (tipo, aluno, descrição, profissional, medida, gerente comunicado). Em "Lesão" ou "Conflito", aviso na tela para comunicar o Gerente de Unidade imediatamente.
6. **Organização e segurança** — sala organizada e segura; problema de estrutura/equipamento com impacto, providência e gerente comunicado, com o mesmo aviso quando houver risco.
7. **Pendências e prioridade** — lista de pendências (pendência, responsável, prazo, acompanhamento) e prioridade técnica do próximo dia, com detalhamento quando não for "Nenhuma".

Regras aplicadas: campos principais obrigatórios; campo condicional passa a ser obrigatório quando aparece; sem nota de 1 a 5; sem perguntas de ficha de treino; rascunho recuperado se a página fechar; tela de confirmação (resumo) antes do envio; data e hora do envio registradas.

## Registro e quem vê

- Cada envio fica salvo vinculado à unidade, ao nome do coordenador e à data.
- Segundo envio do mesmo coordenador, mesma unidade e mesma data pede confirmação de substituição; ao substituir, a versão anterior fica guardada no histórico.
- Consulta dos resultados: admin, gerente e coordenador nas unidades a que têm acesso. Recepção não vê o formulário nem os resultados.

## Resumo enviado ao grupo

Mensagem montada no servidor exatamente no formato que você passou, com todas as linhas sempre presentes ("Não se aplica", "Nenhuma" ou zero quando vazio) e listas numeradas quando houver vários desvios, feedbacks, ocorrências, treinadores ou pendências. Nada é cortado.

## Detalhes técnicos

- **Migração**: nova tabela `public.encerramento_tecnico_respostas` (unidade, unidade_id, coordenador_nome, data, campos de cada bloco, listas dinâmicas em `jsonb`, `substitui_resposta_id`, `created_at`/`updated_at` + trigger). GRANTs: `INSERT` para `anon, authenticated`; `SELECT/UPDATE/DELETE` para `authenticated`; `ALL` para `service_role`. RLS: insert público (mesmo padrão de `insert_encerramento_coordenador_public`), leitura/edição para `admin`, `gerente` e `coordenador` com acesso à unidade via `has_role` + `user_has_unidade_access` — nenhuma política para `user`/recepção. Tabela irmã `encerramento_tecnico_historico` guardando o snapshot `jsonb` das substituições, com as mesmas regras de leitura.
- **Front-end**: nova página `src/pages/EncerramentoTecnico.tsx` reutilizando `StepShell`, `OptionCard`, `useFormDraft`/`submitWithRetry`/`clearDraft`, `UNIDADES_FORMULARIO` e `submitFormularioPublico`. Rota pública em `src/App.tsx`. Cartão fixo em `FormulariosList.tsx`.
- **Back-end**: acrescentar `coordenador_tecnico` a `TIPOS_FORMULARIO`, `TIPO_TITULO` e `TIPO_TABLE` em `supabase/functions/_shared/notifyFormularioCore.ts`, com um renderer dedicado que segue o template pedido (linhas fixas + listas numeradas). Deploy de `submit-formulario-publico` e `notify-formulario-encerramento`. Nada muda nos formulários e automações existentes.
- **Admin**: acrescentar a chave `coordenador_tecnico` à lista de `FORMULARIOS` em `src/pages/admin/GruposWhatsApp.tsx`.
