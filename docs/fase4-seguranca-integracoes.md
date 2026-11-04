# Fase 4 — Segurança, integrações e desempenho (04/11/2026)

## Falhas encontradas e corrigidas
1. Menu liberava todos os itens quando o papel do usuário ainda não estava carregado (fail-open). Agora nada aparece até o papel de `user_roles` ser lido.
2. Item "Usuários" e selo "Master" dependiam de e-mail fixo no código (expunha e-mail e contrariava a regra de admin só pelo servidor). Agora usam apenas o papel admin; a rota já era protegida por `AdminRoute`.

## Verificado sem falha
- Todos os 15 usuários possuem papel.
- Endpoints sem JWT exigem cron secret, token próprio ou estado OAuth (NPS, boas-vindas, presença, BTG callback, comunicado Telegram, confirmações FU).
- Endpoints de usuários/Telegram/Z-API exigem `has_role` admin.

## Pendências (exigem aprovação — RLS/SQL)
- Varredura: políticas abertas em `task_history` e encerramentos (inserção pública intencional nos formulários públicos; revisar).
- Linter: 58 funções SECURITY DEFINER executáveis por anon/autenticados, 4 sem search_path, 7 tabelas com RLS sem política.
- Exclusão de "Manu" nos mapeadores de comissão/executivo é regra de cálculo; mantida.
- Logs de rede da prévia indisponíveis; duplicidade de requisições não medida.

## Testes
113 testes automáticos (Fases 1–3) passaram; build OK. Sem mensagens, migrations, publicação ou dados alterados.
