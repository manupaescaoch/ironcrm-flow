## Objetivo
Transformar o campo **Pauta da reunião** num editor estilo bloco de notas com formatação (negrito, itálico, listas, títulos, etc.) e suporte a **tabelas**.

## Stack
Usar **Tiptap** (já é padrão React + Tailwind, leve, headless), com extensões:
- `@tiptap/react`, `@tiptap/starter-kit` (negrito, itálico, sublinhado, listas, headings, blockquote, código)
- `@tiptap/extension-table`, `table-row`, `table-cell`, `table-header` (tabelas com add/remove linhas/colunas)
- `@tiptap/extension-underline`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`

O conteúdo é salvo como **HTML** no mesmo campo `pauta` (text) — sem migração de banco. Pautas antigas em texto puro continuam aparecendo normalmente (HTML aceita texto livre).

## Mudanças

### 1. Novo componente `src/components/ui/rich-text-editor.tsx`
- Editor Tiptap reutilizável com toolbar fixa no topo.
- Toolbar: Negrito · Itálico · Sublinhado · H2/H3 · Lista · Lista numerada · Citação · Link · **Inserir tabela** · Adicionar linha/coluna · Remover linha/coluna · Desfazer/Refazer.
- Visual estilo "bloco de notas": fundo `bg-background`, borda sutil, padding generoso, fonte do projeto, `prose prose-sm` para estilizar conteúdo.
- Props: `value`, `onChange`, `placeholder`, `minHeight`.

### 2. `src/components/reunioes/NovaReuniao.tsx`
- Trocar o `<Textarea>` da pauta pelo `<RichTextEditor>`.
- Validação: usar `editor.getText().trim()` para checar se está vazio (HTML pode ter `<p></p>` vazio).
- Salvar `editor.getHTML()` em `pauta`.

### 3. `src/components/reunioes/ReuniaoDetalheDrawer.tsx`
- Renderizar `reuniao.pauta` como HTML com `dangerouslySetInnerHTML` dentro de um wrapper `prose prose-sm` para estilo de tabelas/listas/títulos.
- Sanitizar com **DOMPurify** antes de injetar (segurança XSS).

### 4. `src/components/reunioes/ReunioesHistorico.tsx`
- Preview da coluna "Pauta" na tabela: extrair texto puro (strip de tags) e truncar — evita HTML solto na linha.
- Busca (`hay`) também usa o texto puro.

### 5. CSS — `src/index.css`
- Adicionar estilos `.tiptap-editor` para tabelas (borda, header destacado, células com padding), placeholder e foco. Tudo via tokens semânticos do tema.

## Detalhes técnicos
- Dependências novas: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`, `@tiptap/extension-underline`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `dompurify`, `@types/dompurify`.
- Coluna `pauta` permanece `text` — sem migração.
- Compatibilidade retroativa: registros antigos (texto puro) renderizam corretamente como HTML.
- Acessibilidade: botões da toolbar com `aria-label` e estado `aria-pressed` quando ativo.

## Fora do escopo
- Não mexer no campo `feedback` (também é texto). Posso aplicar o mesmo editor a ele depois, se quiser.
- Sem upload de imagem no editor nesta entrega.