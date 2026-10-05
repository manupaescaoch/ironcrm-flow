# Architecture Decisions

- Keep `gestao_metas.meta_alunos_mes` as the backward-compatible minimum monthly target and store the optional stretch target in `supermeta_alunos_mes`, because existing reports and integrations depend on the legacy column.