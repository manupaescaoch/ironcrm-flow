
## Objetivo

Melhorar a tela de detalhes da reunião (drawer) deixando a leitura mais clara e organizada, e adicionar um sistema de **comentários** persistidos, com histórico de quem comentou e quando.

---

## 1. Redesenho do drawer de detalhes (`ReuniaoDetalheDrawer.tsx`)

Layout mais escaneável, dividido em blocos visuais bem separados:

- **Cabeçalho destacado**: tipo da reunião em destaque, badge de status à direita, linha secundária com data formatada por extenso (ex.: "31 de maio de 2026"), unidade e responsável com ícones.
- **Cards de resumo** no topo (grid 2 colunas): Responsável • Participantes (contagem + chips) • Data • Status.
- **Abas** (Tabs do shadcn) para reduzir scroll vertical:
  1. **Pauta** — pauta renderizada (já existe), com botões PDF/TXT.
  2. **Feedback** — feedback da reunião.
  3. **Anexos** — lista de arquivos (já existe).
  4. **Comentários** — novo (ver seção 2).
- Footer fixo com ação de excluir (somente admin/coordenador), igual ao atual.

Sem mudanças de regra de negócio — apenas reorganização visual usando tokens do design system.

---

## 2. Novo recurso: comentários na reunião

### Banco de dados (migration)

Nova tabela `reuniao_comentarios`:

- `id` (uuid PK)
- `reuniao_id` (uuid, FK lógico para `reunioes.id`, ON DELETE CASCADE)
- `unidade_id` (uuid) — para RLS por unidade
- `autor_id` (uuid) — `auth.uid()` do autor
- `autor_nome` (text) — snapshot do nome do autor (igual ao padrão de anexos)
- `conteudo` (text, NOT NULL)
- `created_at` / `updated_at` (timestamptz)

GRANTs:
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.reuniao_comentarios TO authenticated`
- `GRANT ALL ... TO service_role`

RLS (mesmo modelo das outras tabelas do módulo):
- **SELECT**: admin OR `unidade_id IN get_user_unidades(auth.uid())`
- **INSERT**: mesmo escopo + `autor_id = auth.uid()`
- **UPDATE**: admin/coordenador OR `autor_id = auth.uid()` (autor pode editar o próprio)
- **DELETE**: admin/coordenador OR `autor_id = auth.uid()`

Trigger de `updated_at` reutilizando `public.update_updated_at_column()`.

### Hook `useReuniaoComentarios.ts` (novo)

API: `{ comentarios, loading, adicionar(texto), editar(id, texto), remover(id) }`. Busca por `reuniao_id` ordenando por `created_at asc`.

### UI dentro da aba "Comentários" do drawer

- Lista cronológica de comentários: avatar/iniciais do autor, nome, data/hora relativa, conteúdo (whitespace-pre-wrap).
- Ações por comentário: editar/remover para o próprio autor e para admin/coordenador.
- Campo de novo comentário no rodapé da aba: `Textarea` + botão "Comentar" (desabilitado se vazio). Envia com Ctrl/⌘+Enter.
- Estado vazio amigável ("Nenhum comentário ainda. Seja o primeiro a comentar.").
- Contador de comentários no rótulo da aba (ex.: "Comentários (3)").

### Histórico

Os comentários ficam vinculados à reunião e aparecem automaticamente no histórico (`ReunioesHistorico`) ao reabrir o detalhe. Adicionalmente:

- Na tabela do histórico, novo indicador discreto na coluna "Pauta" ou ao lado do status: ícone `MessageSquare` + contagem (quando > 0), para sinalizar reuniões com discussão.

---

## Arquivos afetados

- **Migration nova**: criar tabela `reuniao_comentarios` + GRANTs + RLS + trigger.
- **Novo**: `src/hooks/useReuniaoComentarios.ts`.
- **Novo**: `src/components/reunioes/ReuniaoComentarios.tsx` (lista + form).
- **Editar**: `src/components/reunioes/ReuniaoDetalheDrawer.tsx` — novo layout em abas + integração da aba de comentários.
- **Editar (opcional)**: `src/components/reunioes/ReunioesHistorico.tsx` — badge de contagem de comentários na linha.

---

## Pontos a confirmar

1. Comentários devem ser **editáveis** pelo próprio autor depois de enviados, ou somente leitura após postar?
2. Admin/coordenador podem excluir comentários de outros usuários? (proposta acima: sim.)
3. Deseja indicador de contagem de comentários na tabela de histórico? (proposta acima: sim.)
