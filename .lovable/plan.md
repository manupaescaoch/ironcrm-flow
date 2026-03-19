

## Adicionar campos Setor, Turno e WhatsApp do Grupo ao cabeçalho do Formulário

Baseado no screenshot de referência, o cabeçalho do formulário precisa de 3 campos adicionais: **Setor**, **Turno** e **WhatsApp do Grupo para Respostas**, além de um toggle **Formulário Ativo**.

### Banco de dados

Migration para adicionar 3 colunas na tabela `formularios`:
- `setor` (text, default 'geral')
- `turno` (text, default 'integral')  
- `whatsapp_grupo` (text, nullable) — ID/número do grupo WhatsApp onde as respostas serão enviadas

### Alterações em código

1. **`src/hooks/useFormulariosData.ts`** — Atualizar interface `Formulario` com os 3 novos campos. Atualizar mutations `useCreateFormulario` e `useUpdateFormulario` para incluir `setor`, `turno` e `whatsapp_grupo`.

2. **`src/components/cronograma/FormularioBuilder.tsx`** — Expandir o card "Informações" com:
   - Título e Descrição (já existem)
   - Linha com **Setor** (select: Recepção, Musculação, Limpeza, Geral) e **Turno** (select: Manhã, Tarde, Noite, Integral)
   - Campo **WhatsApp do Grupo para Respostas** com helper text "ID do grupo onde as respostas serão enviadas"
   - Toggle **Formulário Ativo** com descrição "Formulários inativos não aparecem para preenchimento"

### Resultado visual

O cabeçalho do formulário ficará idêntico ao screenshot de referência, com todos os campos de configuração agrupados em um único card antes da seção de campos/perguntas.

