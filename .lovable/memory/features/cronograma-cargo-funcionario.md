---
name: Cargo do funcionário define formulário
description: cronograma_funcionarios.cargo é a fonte da verdade para qual formulário de encerramento cada pessoa recebe.
type: feature
---
Tabela `cronograma_funcionarios` tem coluna `cargo` com 4 valores válidos:
- `recepcao` → Relatório Diário Comercial (`/relatorio-diario-comercial`)
- `coordenador_unidade` → Encerramento Coordenador de Unidade (`/encerramento-coordenador`)
- `treinador` → Encerramento Coordenador de Horário (`/encerramento-horario`)
- `estagiario_lider` → Encerramento de Turno (`/encerramento-turno`)

Edge function `send-formulario-lembretes` segue ordem de prioridade:
1. `cargo` cadastrado vence tudo.
2. Fallback por nome (lista hardcoded legada).
3. Fallback por palavras-chave no título da atividade.

NUNCA voltar a priorizar título sobre cargo/nome — o título é genérico (ex: "Encerramento — Coordenador de Horário") e foi a causa de recepcionistas receberem o link errado.

UI: `FuncionariosTab` mostra cargo como badge e exige seleção no cadastro (badge vermelha "não definido" quando ausente).
