## Objetivo

Tornar o **telefone o identificador único** dos leads e impedir cadastros duplicados. Padronizar o campo para aceitar **apenas números** (sem traços, parênteses ou espaços) tanto no cadastro quanto na edição.

## Escopo

### 1. Padronizar input de telefone (somente números)

Em todos os formulários de cadastro/edição de lead:
- `src/pages/CRM.tsx` — modal "Novo Lead" (linha ~1058)
- `src/pages/LeadDetail.tsx` — edição de lead (linha ~663)
- `src/pages/CRM.tsx` — importação CSV/XLSX (já normaliza, apenas reforçar)

Comportamento do campo:
- `inputMode="numeric"` e `pattern="[0-9]*"` para abrir teclado numérico em mobile
- `onChange` filtra qualquer caractere não numérico (`value.replace(/\D/g, '')`)
- `maxLength={11}` (DDD + 9 dígitos)
- `placeholder="11999999999"` (sem máscara visual)
- Validação Zod: `z.string().regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos numéricos')`

### 2. Reforçar checagem de duplicidade no front (CRM "Novo Lead")

Hoje a checagem em `CRM.tsx` (linha 400) filtra **por unidade**. Como o telefone agora é o ID global do lead:
- Remover o filtro `eq('unidade_id', unidadeAtual.id)` da query de duplicidade
- Mensagem de erro deve informar a unidade do lead duplicado quando for de outra unidade  
  Exemplo: "Telefone já cadastrado para BRUNA ALENCAR na unidade Iron Zona Norte."

### 3. Banco de dados

O trigger `check_duplicate_lead` já valida duplicidade global por telefone normalizado (em leads ativos). Nenhuma migração necessária — apenas garantir que o front envie o telefone já normalizado (apenas dígitos) no `insert/update`.

## Fora de escopo

- Não alterar leads históricos já gravados com máscara (`(11) 99999-9999`) — a normalização do trigger já cuida disso na comparação.
- Não mexer em telefones de fornecedores, funcionários ou usuários.
- Sem mudanças em backend functions, RLS, ou outras telas.

## Arquivos afetados

- `src/pages/CRM.tsx` — input do modal Novo Lead + remoção do filtro de unidade na checagem de duplicidade + schema Zod
- `src/pages/LeadDetail.tsx` — input de telefone na edição
