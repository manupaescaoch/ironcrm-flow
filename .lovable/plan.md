## Problema

A página pública `/relatorio-diario-comercial` é acessada sem login (recepção preenche pelo celular). Hoje a única policy de INSERT em `relatorio_diario_comercial_respostas` exige `auth.uid() IS NOT NULL`, então toda submissão pública é bloqueada com `new row violates row-level security policy`.

Os outros formulários públicos da família (`encerramento_turno_respostas`, `encerramento_horario_respostas`, `encerramento_coordenador_respostas`) têm uma policy `*_public` para `anon, authenticated` com validação por `NOT NULL` + tamanho de campos. Esse padrão foi perdido aqui durante o audit 0024.

## Correção

Migração que adiciona uma policy pública de INSERT alinhada ao padrão já existente, mantendo a policy autenticada atual:

```sql
GRANT INSERT ON public.relatorio_diario_comercial_respostas TO anon;

CREATE POLICY insert_relatorio_diario_comercial_public
ON public.relatorio_diario_comercial_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (
  nome IS NOT NULL
  AND char_length(btrim(nome)) BETWEEN 1 AND 200
  AND unidade IS NOT NULL
  AND char_length(btrim(unidade)) BETWEEN 1 AND 100
  AND data IS NOT NULL
  AND submitted_by IS NULL
);
```

Pontos:
- `submitted_by IS NULL` impede que um anon injete um user_id alheio. Submissões autenticadas continuam podendo informar `submitted_by = auth.uid()` pela policy existente.
- SELECT/UPDATE/DELETE continuam restritos como hoje (admin / scoped). Sem leitura pública.
- Sem alteração em frontend.

## Validação

Após aplicar, reabrir `/relatorio-diario-comercial` no celular, preencher e enviar — deve concluir sem o erro de RLS, e a mensagem do grupo WhatsApp continua disparando via `submit-formulario-publico`.
