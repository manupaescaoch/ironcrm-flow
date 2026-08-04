# Bloquear leads duplicados pelo telefone

## Situação atual (verificada)

- O banco já tem uma trava (trigger `check_duplicate_lead`) que bloqueia telefone repetido, mas ela só considera leads **ativos** e compara apenas os dígitos "crus" do número.
- A comparação por dígitos crus deixa passar variantes do mesmo número: `8195490708` (sem o 9) e `81995490708`, ou números salvos com `55` na frente, são tratados como telefones diferentes.
- O telefone é **opcional** no cadastro do CRM. Lead sem telefone não passa por nenhuma checagem — foi assim que surgiram cadastros com o mesmo nome repetido (caso "LIANA BEATRIZ...").
- Existem hoje 8 pares de leads ativos com o mesmo telefone na unidade Boa Viagem (cadastrados em dezembro, antes da trava atual) e vários nomes repetidos.

## O que será feito

1. **Telefone obrigatório no cadastro de lead** (CRM > Novo Lead). Sem telefone válido (10 ou 11 dígitos) não é possível salvar.
2. **Comparação inteligente do número**: antes de comparar, o sistema passa a padronizar o telefone (remove máscara, remove o `55` inicial, e trata a ausência/presença do 9 do celular). Assim `81 9 9549-0708`, `8195490708` e `558195490708` são reconhecidos como o mesmo lead.
3. **Bloqueio na hora do cadastro, com aviso claro**: ao tentar cadastrar um telefone já existente na unidade, aparece um alerta "Lead já existe" mostrando o nome do lead encontrado, quando foi cadastrado, por quem, e um botão "Abrir lead existente" que leva direto ao perfil dele. Nada é salvo.
4. **Leads inativos também são detectados**: se o telefone pertencer a um lead desativado, o aviso informa isso e oferece reativar o lead existente em vez de criar um novo.
5. **Mesma regra na importação (CSV/Excel)**: linhas cujo telefone já existe na unidade continuam sendo marcadas como duplicadas e não importadas, agora usando a mesma padronização do número.
6. **Trava no banco reforçada**: a regra do servidor passa a usar a mesma padronização e a considerar leads inativos, garantindo que nenhum caminho (importação, automações, integrações) crie duplicado.
7. **Aviso de nome parecido (não bloqueia)**: se o telefone for novo mas já existir um lead com nome idêntico na unidade, o formulário mostra um aviso amarelo "Já existe um lead com este nome" e o usuário decide continuar.

Regra de unidade mantida: a duplicidade é verificada **dentro da mesma unidade** — o mesmo aluno pode existir em EVO BOA VIAGEM e EVO MADALENA.

## Detalhes técnicos

- Nova função de banco `public.canonical_phone(text)`: remove não-dígitos, remove prefixo `55` quando o resto tem 10/11 dígitos, e devolve a forma com 11 dígitos (insere o 9 quando faltar em celular).
- Atualizar `check_duplicate_lead()` para usar `canonical_phone` e remover o filtro `ativo = true`, retornando na exceção nome, id e status ativo/inativo do lead existente.
- Atualizar o trigger `set_lead_telefone_normalizado` para gravar `telefone_normalizado` já canônico; migração de backfill em `leads` existentes (sem apagar nada).
- Índice `idx_leads_telefone_normalizado` recriado sem o filtro `WHERE ativo = true`.
- Frontend: novo helper `src/lib/telefone.ts` com `canonicalPhone()` reutilizado em `CRM.tsx` (cadastro manual e importação).
- `src/pages/CRM.tsx`: telefone obrigatório no `leadSchema`; a busca de duplicidade passa a consultar por `telefone_normalizado` (todos os leads da unidade, ativos e inativos) e abrir o novo diálogo.
- Novo componente `src/components/crm/LeadDuplicadoDialog.tsx` (padrão do `DuplicidadeDialog` de Contas a Pagar) com ações "Abrir lead existente" / "Reativar lead" / "Cancelar".
- Os 8 pares já existentes no banco não serão apagados automaticamente; a nova trava impede novos casos. Se quiser, faço depois uma limpeza revisada desses registros.
