
# Reestruturação dos envios automáticos pós-bloqueio

## Princípio

**Zero envio automático para o lead.** O chip de automação não fala mais com cliente final, só com canais internos. Isso elimina a causa raiz do bloqueio (volume + repetição + mensagens não solicitadas).

## Fluxos novos

### 1. Follow-ups → grupo comercial da unidade

```text
[pg_cron 09:00 BRT, seg-sex]
        │
        ▼
[edge: send-fu-digest-comercial]
   ├── lê follow_ups (status='pendente', data_prevista <= hoje, lead ativo, não matriculado)
   ├── agrupa por unidade_id
   ├── monta 1 msg por unidade (template fixo no servidor)
   └── envia ao grupo_fu_id configurado da unidade
```

- **NÃO** marca o follow-up como concluído.
- Permanece `pendente` até humano da CRM marcar manualmente em `/dashboard` (botão já existente).
- Se ficar pendente, reaparece no digest do dia seguinte naturalmente.
- Mensagem termina com instrução: "marque como enviado na CRM após disparar".

### 2. Confirmação experimental → telefone da recepção (1:1)

```text
[pg_cron a cada 30 min, 07:00-21:00 BRT]
        │
        ▼
[edge: send-confirmacao-recepcao]
   ├── 24h antes: leads com aula em [agora+23h30, agora+24h30] e confirmacao_24h_enviada_em IS NULL
   ├── 2h antes:  leads com aula em [agora+1h30, agora+2h30]  e confirmacao_2h_enviada_em  IS NULL
   ├── agrupa por unidade_id
   ├── monta 1 msg consolidada com lista (24h e 2h misturados, ordenados por hora)
   └── envia ao telefone_recepcao da unidade (chat 1:1)
   └── marca timestamps em leads
```

- Recepção recebe lista e dispara manualmente do número comercial dela.
- Marcação automática dos flags `confirmacao_*_enviada_em` evita reenvio.

## Banco

### Nova tabela `unidade_whatsapp_config`

| coluna | tipo | descrição |
|---|---|---|
| `unidade_id` | uuid PK | FK unidades |
| `grupo_fu_id` | text | id do grupo WhatsApp comercial para FU |
| `grupo_fu_nome` | text | rótulo |
| `telefone_recepcao` | text | número da recepção (formato 55DDDXXXXXXXX) |
| `ativo` | boolean | default true |
| timestamps | | |

- RLS: admin gerencia tudo; coordenador/user da unidade pode ler.
- GRANT padrão.

## Edge functions

### Nova: `send-fu-digest-comercial`
- `verify_jwt = false`, chamada pelo pg_cron.
- Roda seg-sex 09h BRT, idempotente por dia (idempotency_key = `fu-digest|{unidade}|{date}`).
- Reusa `formulario_envios_log` para auditoria/idempotência.
- Template fixo no servidor, só interpola `{nome}`, `{telefone}`, `{tipo}` por linha.

### Nova: `send-confirmacao-recepcao`
- `verify_jwt = false`, chamada pelo pg_cron.
- Roda 07-21h BRT a cada 30 min.
- Mesma idempotência (`conf-recep|{unidade}|{slot}`).

### Desativar/aposentar
- `send-follow-ups-automaticos`: parar de chamar. Manter código por 1 sprint, então remover.
- `confirmacao-experimental-automatica`: idem.
- pg_cron antigo dessas duas funções: desabilitar.

## Frontend

### Nova: `/admin/whatsapp-comercial`
- Admin only.
- Lista unidades, edita `grupo_fu_id` e `telefone_recepcao`.
- Botão "Testar grupo FU": envia mensagem de teste fixa server-side.
- Botão "Testar recepção": envia "Teste de canal IRON" para o número.

### Sem outras telas novas
- Marcação manual de FU já existe em `PendenciasDia` / lead detail.
- Dashboard continua mostrando FU pendente — única mudança é que o status só muda quando humano marca.

## Templates server-side (não editáveis pelo cliente)

### FU digest (grupo)
```
📋 *FOLLOW-UPS DO DIA — {UNIDADE}*
{DATA}

Total pendente: {N}

1. *{NOME}* — {TELEFONE_FORMATADO}
   Tipo: {D+X}  •  Vencido há: {N} dia(s)
   ↳ Mensagem sugerida:
   "{TEMPLATE_RENDERIZADO}"

2. ...

━━━━━━━━━━━━━━━
⚠️ Após enviar, marque o lead como contatado na CRM.
```

### Confirmação (chat recepção)
```
📞 *CONFIRMAÇÕES DE EXPERIMENTAL — {UNIDADE}*
{DATA} • {HORA}

⏰ EM 24H
1. *{NOME}* — {TELEFONE} — amanhã às {HORA}
   ↳ "Oi, {nome}! ..."

⏰ EM 2H
1. *{NOME}* — {TELEFONE} — hoje às {HORA}
   ↳ "Oi, {nome}! ..."
```

## Volume esperado

| canal | antes | depois |
|---|---|---|
| Chip → leads | ~50/dia | **0** |
| Chip → grupo comercial (N unidades) | 0 | ~N msgs/dia (1 por unidade) |
| Chip → recepções (N unidades) | 0 | ~N×duas janelas com lista consolidada |

Total: cai de ~50 para ~10-15 msgs/dia, todas para canais internos conhecidos. Risco de bloqueio: praticamente zero.

## Ordem de execução

1. Criar tabela `unidade_whatsapp_config` + RLS + GRANTs.
2. Criar `/admin/whatsapp-comercial` (cadastro + testes).
3. Implementar `send-fu-digest-comercial` (sem agendar cron ainda).
4. Implementar `send-confirmacao-recepcao` (sem agendar cron ainda).
5. Você testa ambos manualmente via botões da página admin.
6. Quando ok: desativar pg_cron das funções antigas + agendar pg_cron das novas.
7. (Opcional, 1 sprint depois) remover funções antigas.

## Fora do escopo agora

- Cloud API oficial (híbrido) — fica como evolução futura, não é necessário pra resolver o bloqueio.
- Variação de templates com IA — não é mais relevante, mensagens vão pra grupo interno.
- Outras automações Z-API (rotinas, tarefas, anamnese, encerramentos) — continuam como estão, são internas e baixo volume.

Confirma esse desenho? Se sim, sigo na ordem 1→4 sem conectar o WhatsApp ainda.
