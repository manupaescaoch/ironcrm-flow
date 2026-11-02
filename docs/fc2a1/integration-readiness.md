# FC-2A.1 — Inactive integration preparation

The shared dispatcher is a tested contract, **not connected to production writers**. `experimentalWriters` lists every known boundary; activation must require all entries. No RPC or feature gate is called by the running app in this preparation.

| Writer | Required atomic boundary |
|---|---|
| CRM create / EVO inbound | Lead + interaction + new pending cycle, preserving existing validation/duplicate semantics |
| LeadDetail create/edit | Lead slot sync + mixed interaction fields + explicit presence command; no null-to-false on untouched input |
| LeadDetail lead-slot | Route schedule changes through cycle operation; inverse lead-time trigger must not overwrite tracked slots |
| LeadDetail delete | Operational cancel/inactivate instead of deletion when evidence exists |
| Dashboard remove | Inactivate tracked appointment; preserve evidence |
| EventosHoje presence/absence | Trainer validation remains; atomic result commit, exactly one REAG owner after first committed absence |
| EventosHoje trainer | Unrelated trainer edit does not confirm presence |
| EventosHoje / ConfirmacoesAmanha cancel | Preserve existing user outcome; distinguish legacy broad FU cancellation from safe tracked cycle behavior |
| ConfirmacoesAmanha edit | Notes/agenda confirmation do not create attendance; slot edits use rebooking operation |
| ReagendarModal | Old cycle frozen + successor pending; compatibility lead/interaction slot updates in one transaction |
| Telegram callback | Exact chat/message/control/cycle, group authorization, atomic outcome and no legacy fallback |
| Telegram send | New-cycle unique claim; legacy partial-index upsert needs explicit conflict handling before deployment |
| Telegram synchronize | Branch by cycle, invalidate old message; never infer new attendance from legacy flag |

## Outstanding activation blockers

- All above call sites must be connected and exercised end-to-end before marking readiness complete. This preparation defines/tests the dispatcher but does not assert those call sites are integrated.
- Proposed SQL is intentionally NOT in migration history and NOT applied to production. Production approval is not requested while integration gaps remain.
- Recipient is unresolved: live active reception staff in Setúbal/Boa Viagem/Madalena have no linked user IDs; Aflitos/Santa Cruz have no identified reception staff. Use EVO OPS personal notification only after an explicit real user is linked to staff and unit; no name matching or fabricated contact.
- Trigger fixture uses the exact 19 installed bodies (internal host sanitized) with inert HTTP/contact helpers. Lead-side inverse sync and the full task/contact subsystem require additional regression fixture before activation.
- Candidate RPC for prospective adoption is not a complete transactional create/edit API. Client-supplied actor is accepted only by service RPC; the eventual authenticated endpoint must derive manual actor from validated JWT, never body.
- REAG endpoint remains unchanged. Candidate creates only the internal OPS alert; it does not send WhatsApp or create a second messaging route. Provider claim/retry behavior requires end-to-end stubbed testing when callbacks are connected.
- Cancellation/inactivation is supported by the SQL candidate; evidence deletion rejected. Retain evidence on rollback, do not revert to blind legacy mutations of tracked rows.