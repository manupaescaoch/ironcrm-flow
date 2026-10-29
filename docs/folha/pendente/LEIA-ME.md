# Ajuda de Custo mensal — pacote pendente de aprovação

Nada aqui foi aplicado em produção.

Ordem de implantação (após autorização):
1. Aplicar `0033_evo_folha_ajuda_custo_mensal.sql` (tabelas, fechamento próprio, lote Clara da ajuda aceitando o fechamento próprio).
2. Mover `src/lib/folha/ajudaMensal.ts` para `supabase/functions/_shared/folhaMotor.ts` e fazer `src/lib/folha/ajudaMensal.ts` reexportar do motor.
3. Aplicar `functions/folha-operacoes.patch` (ações ajuda_dados, ajuda_preparar, ajuda_salvar, ajuda_fechar, ajuda_reabrir) e implantar somente `folha-operacoes`.
4. Publicar a interface.

Reversão: desfazer a publicação; reimplantar a função anterior; as tabelas novas ficam sem uso (não apagar). `folha_lote_ajuda` e `folha_congelar_ajuda_parcelas` voltam pela definição da 0032.

Ensaio isolado: `ENSAIO_0033_resultado.txt` (Postgres local, dados fictícios, permissões simuladas).
