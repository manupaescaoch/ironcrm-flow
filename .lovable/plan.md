## Páginas NPS — Iron Lifting Club

Duas páginas: formulário **público** `/nps` (sem login) e painel admin/coordenador `/nps/respostas`.

---

### 1. Banco de dados

Nova tabela `public.nps_respostas`:

- `nome`, `whatsapp`, `unidade_id` (uuid → unidades), `unidade_nome`
- `nota_nps` (int 0-10)
- `estrelas_estrutura`, `estrelas_equipe`, `estrelas_treino` (int 1-5)
- `pontos_positivos` (text[]), `pontos_melhoria` (text[])
- `tempo_aluno` (text)
- `comentario` (text, opcional)
- `categoria` (text gerado: detrator/passivo/promotor)
- `created_at`

GRANT + RLS:
- `INSERT`: liberado para `anon` e `authenticated` (formulário público)
- `SELECT`: apenas admin e coordenador (via `has_role`); admin vê tudo, coordenador filtra por unidades vinculadas
- `service_role`: ALL

### 2. Página `/nps` — Formulário público

Rota **fora** de `ProtectedRoute` (igual ao `/anamnese` já existente). O aluno informa:

- Nome (text, obrigatório, UPPERCASE)
- WhatsApp (text, obrigatório, máscara BR)
- Unidade (Select: Madalena, Boa Viagem, Setúbal — carregada de `unidades`)
- Nota NPS 0–10: 11 botões grandes coloridos (0–6 vermelho, 7–8 laranja, 9–10 verde) via tokens semânticos
- 3 blocos de estrelas 1–5 (estrutura, equipe, treino)
- Checkboxes pontos positivos: agendamento, equipamentos, treinadores, ambiente, resultado, limpeza
- Checkboxes melhorias: horários, equipamentos, atendimento, app, vestiário, planos
- Radio tempo de treino: <1 mês, 1–3 meses, 3–6 meses, 6m–1 ano, >1 ano
- Textarea comentário (opcional)
- Botão "Enviar avaliação" → insert direto via cliente anon → tela de agradecimento

Validação Zod (nome, telefone, unidade, nota e 3 estrelas obrigatórios; limites de tamanho).

Webhook Make: **não implementar agora**. Deixar a tabela e o submit prontos; integração externa fica para depois.

### 3. Página `/nps/respostas` — Painel admin/coordenador

Rota nova com `AdminOrCoordenadorRoute` (já existe no `App.tsx`).

**KPIs** (cards no padrão dos KPIs atuais):
- Score NPS geral = `%promotores − %detratores`
- NPS Madalena, NPS Boa Viagem
- Total respostas, %Detratores, %Passivos, %Promotores

**Filtros** acima da tabela:
- Unidade: Madalena, Boa Viagem, Setúbal, Todas
- Período: 7d, 30d, 90d, personalizado (date range)
- Categoria: Detrator (0–6), Passivo (7–8), Promotor (9–10)

**Tabela**: nome, unidade, nota (badge colorido), ⭐ estrutura/equipe/treino, tempo, pontos positivos (chips), melhorias (chips), comentário (truncado + hover), data. Ordenação por data desc.

Hook `useNpsRespostas` com React Query: fetch + cálculo dos KPIs no client.

### 4. Navegação

- Item "Respostas NPS" no menu admin/coordenador (`Layout.tsx`) apontando para `/nps/respostas`
- O `/nps` é público — divulgação por link externo, sem entrada no menu logado

---

### Notas técnicas

- Componentes shadcn já disponíveis: `Card`, `Checkbox`, `RadioGroup`, `Textarea`, `Select`, `Popover`, `Table`, `Badge`, `Button`
- Estrelas: componente próprio com `Star` do `lucide-react`
- Categoria derivada por coluna gerada: `nota <= 6 → detrator`, `7–8 → passivo`, `9–10 → promotor`
- Datas: `new Date(ano, mes-1, dia)` (regra de timezone do projeto)
- Cores via tokens semânticos do `index.css` (sem hex hardcoded)
- Texto em UPPERCASE segue regra global (`Textarea` já força)
