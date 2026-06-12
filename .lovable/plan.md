## Problema

O cartão "Alunos Ativos" mostra que salvou, mas o número não muda. Causa: as políticas de segurança da tabela `gestao_metas` só permitem inserir/atualizar para **admin** ou **coordenador**. Recepção e demais usuários têm o salvamento bloqueado silenciosamente pelo banco.

## Solução

1. **Migração no banco** — alterar as políticas de INSERT e UPDATE de `gestao_metas` para permitir qualquer usuário autenticado **vinculado à unidade** (admin continua podendo em todas). Garantir também os GRANTs necessários para `authenticated`.
2. **Frontend (`AlunosAtivosKPI.tsx`)** — tratar o caso em que a atualização não afeta nenhuma linha (mostrar erro em vez de sucesso falso), evitando "salvou mas não mudou" no futuro.

## Detalhes técnicos

- UPDATE/INSERT policy: `auth.uid() IS NOT NULL AND (has_role(auth.uid(),'admin') OR unidade_id IN (SELECT get_user_unidades(auth.uid())))`
- DELETE permanece restrito a admin.
- No update do frontend, usar `.select()` para verificar se alguma linha foi de fato atualizada.