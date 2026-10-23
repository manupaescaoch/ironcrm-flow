# Architecture Decisions
- Apply the shared manager messaging policy before operational channel fallback and disable legacy manager WhatsApp summary handlers, so manager notifications cannot silently revert from Telegram to WhatsApp.

- Keep `gestao_metas.meta_alunos_mes` as the backward-compatible minimum monthly target and store the optional stretch target in `supermeta_alunos_mes`, because existing reports and integrations depend on the legacy column.
- Run the unit-scoped manager FU digest inside the existing operational-summary cron callback, with a Recife weekday guard and atomic per-unit/day/part send claims, to avoid a second polling schedule and duplicate Telegram broadcasts.
- Use the shared pure FU business-day date module for frontend and Telegram counts, and normalize persisted pending deadlines in the database, so weekend deadlines have one effective date and one owning week.