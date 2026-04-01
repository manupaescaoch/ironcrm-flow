

## Unificar Botões e Expandir Lista de Responsáveis

### O que muda

**1. Remover botão separado "Nova Rotina" — unificar em um único botão "+" com dropdown**
- Substituir os dois botões ("Nova Atividade" + "Nova Rotina") por um único botão `+` com DropdownMenu contendo duas opções: "Nova Atividade" e "Nova Rotina"
- Alternativa mais simples (como no screenshot): manter visual similar ao "Nova Atividade" como botão principal, e "Nova Rotina" como opção secundária no mesmo dropdown

**2. Expandir lista de Responsáveis para incluir usuários da unidade + funcionários da equipe**
- No modal "Nova Atividade", o dropdown de Responsável atualmente só mostra `funcionarios` (tabela `cronograma_funcionarios`)
- Adicionar `useUnidadeUsers()` ao `CronogramaTab` para buscar também os usuários do sistema vinculados à unidade
- Renderizar as duas listas no Select agrupadas:
  - **Grupo "Equipe"**: funcionários da tabela `cronograma_funcionarios` (com telefone)
  - **Grupo "Usuários"**: usuários do sistema da unidade (via `useUnidadeUsers`)
- Aplicar a mesma lógica no modal de edição de atividades

### Arquivos Alterados
- `src/components/cronograma/CronogramaTab.tsx`:
  - Importar `useUnidadeUsers`
  - Adicionar DropdownMenu no header (substituindo os 2 botões)
  - No Select de Responsável (criação e edição): renderizar ambos os grupos com `SelectGroup` + `SelectLabel`

### Detalhes Técnicos
- Usar `SelectGroup` e `SelectLabel` do shadcn/ui para separar visualmente "Equipe" e "Usuários" no dropdown
- Para usuários do sistema, o `value` será o `user.id` (mantendo compatibilidade com `responsavel_id`)
- Para funcionários, continua usando `funcionario.id`
- O preview de WhatsApp busca nome em ambas as listas

