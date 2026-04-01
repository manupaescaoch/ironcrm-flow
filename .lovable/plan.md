

## Importar Escala por Imagem (PNG/JPEG)

### Objetivo
Adicionar um botão "Importar Imagem" na página Escala que permite ao usuário fazer upload de uma foto (PNG/JPEG) de uma tabela de escala. A imagem será processada por IA (Gemini 2.5 Flash via Lovable AI) para extrair os dados da tabela, e o resultado será exibido na mesma tela de preview que o importar texto já usa.

### Mudanças

1. **Criar `src/components/escala/ImportarImagemModal.tsx`**
   - Modal com seleção de mês, ano e unidade padrão (igual ao ImportarTextoModal)
   - Input de arquivo aceitando `.png, .jpeg, .jpg`
   - Preview da imagem selecionada
   - Ao clicar "Processar", envia a imagem para uma edge function que usa Gemini 2.5 Flash para extrair os dados da tabela
   - Recebe o JSON estruturado e exibe na mesma tabela de preview (igual ao fluxo de texto)
   - Permite remover registros e importar para o banco

2. **Criar edge function `supabase/functions/parse-escala-image/index.ts`**
   - Recebe a imagem em base64 + unidade padrão
   - Envia para Gemini 2.5 Flash com prompt instruindo a extrair: final_de_semana, treinador, recepcao, servicos_gerais, seguranca
   - Retorna JSON com array de registros parsed

3. **Atualizar `src/pages/Escala.tsx`**
   - Adicionar botão "Importar Imagem" (ícone `ImagePlus`) ao lado do "Importar Texto"
   - Importar e renderizar o novo modal

### Fluxo do Usuário
1. Clica "Importar Imagem" → Seleciona mês/ano/unidade → Faz upload da foto
2. Clica "Processar" → IA extrai dados → Preview na tabela
3. Revisa, remove linhas indesejadas → Clica "Importar"

### Modelo de IA
Gemini 2.5 Flash (suportado por Lovable AI, sem necessidade de API key do usuário).

