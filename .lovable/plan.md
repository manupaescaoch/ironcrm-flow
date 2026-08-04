# Contas a Pagar: nada é salvo (nem manual, nem por texto)

## Diagnóstico confirmado

O parser de texto está correto — testei com o texto exato do print e ele extraiu tudo:
descrição `SICOOB PA — OLINDA/PE`, vencimento `2026-08-12`, valor `5190.01`, linha digitável completa e unidade `Iron Boa Viagem` (compatível, então o cadastro automático dispara).

O problema é no banco: as tabelas do módulo **não têm permissão de acesso concedida** para usuários logados.

- `contas_pagar`, `contas_pagar_historico`, `contas_pagar_envios` e `unidade_whatsapp_config` não possuem nenhum GRANT para os papéis de aplicação (`authenticated` / `service_role`).
- As políticas de segurança (RLS) existem e estão corretas, mas sem GRANT o banco recusa a operação antes de avaliar a política.
- Resultado: `contas_pagar` está com **0 registros** desde a criação — nenhum cadastro, manual ou por texto, jamais foi gravado.

## Correção

Uma migração de banco concedendo os acessos que faltam:

- `contas_pagar`: SELECT, INSERT, UPDATE para `authenticated`; ALL para `service_role`.
- `contas_pagar_historico`: SELECT, INSERT para `authenticated`; ALL para `service_role`.
- `contas_pagar_envios`: SELECT para `authenticated`; ALL para `service_role` (as funções de automação escrevem por aqui).
- `unidade_whatsapp_config`: SELECT para `authenticated`; ALL para `service_role`.
- Conceder USAGE nas sequences do schema, se houver alguma ligada a essas tabelas.

Nenhuma política de RLS será afrouxada — o isolamento por unidade continua igual.

## Validação

1. Cadastrar a conta do print pela aba "Importar por texto" e confirmar que ela aparece na listagem e nos cards de resumo.
2. Conferir no banco que a linha foi criada com `unidade_id` correto e status `pendente`.
3. Confirmar o registro de histórico e a tentativa de envio ao grupo financeiro em `contas_pagar_envios`.
