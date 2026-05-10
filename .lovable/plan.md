## 🎯 Objetivo

Automatizar 2 mensagens de WhatsApp pro aluno antes da aula experimental:
- **24h antes** — confirmação da aula
- **2h antes** — lembrete + link da anamnese

Envio direto pro telefone do lead via Z-API, com identificação automática de unidade (ZN/ZS) já garantida pelo `lead.unidade_id`.

---

## 🗄️ Mudança no banco

Adicionar 2 colunas em `leads` pra controlar envios e evitar duplicidade:

- `confirmacao_24h_enviada_em` (timestamptz, nullable)
- `confirmacao_2h_enviada_em` (timestamptz, nullable)

Reset automático via trigger sempre que `data_aula_experimental` ou `hora_aula_experimental` mudar (caso reagende, dispara de novo).

---

## ⚙️ Edge function: `confirmacao-experimental-automatica`

**Lógica única, executa a cada 15 min:**

Para cada lead onde:
- `ativo = true`
- `is_matriculado = false`
- `status_funil` ∉ ('convertido', 'perdido')
- `telefone` preenchido
- `data_aula_experimental` + `hora_aula_experimental` definidos

Calcula `momento_aula = data + hora` (timezone BRT) e:

| Janela | Condição | Ação |
|---|---|---|
| **24h** | `momento_aula` entre **23h45 e 24h15** à frente de agora **E** `confirmacao_24h_enviada_em` IS NULL | Envia texto 24h |
| **2h** | `momento_aula` entre **1h45 e 2h15** à frente de agora **E** `confirmacao_2h_enviada_em` IS NULL | Envia texto 2h |

Após envio bem-sucedido, marca o timestamp correspondente. Janela de 30 min cobre o cron de 15 min com folga.

**Templates** (substituem `{nome}`, `{data}`, `{hora}`):

```
[24h]
Oi, {nome}! Tudo certo, sua experimental está confirmada! 🔵

📅 {data} ⏰ {hora}

Chega 15 minutinhos antes, tá? Assim a gente te apresenta como funciona a Iron e já preenche sua ficha antes de começar.

Qualquer imprevisto é só me chamar aqui. A gente se vê em breve! 💪

Equipe Iron
```

```
[2h]
Oi, {nome}! Daqui a pouco é hora do treino. 💪

Queremos te conhecer melhor! Preenche essa ficha rapidinho antes de vir assim a gente garante a melhor experiência pra você aqui na Iron. 😊

👉 https://ironcrm-flow.lovable.app/anamnese

Te esperamos às {hora}. Qualquer imprevisto é só me chamar aqui. 🔵

Equipe Iron
```

Formato: `{nome}` = primeiro nome (UPPERCASE → Title Case), `{data}` = `dd/MM`, `{hora}` = `HH:mm`.

---

## ⏱️ Cron

Job `confirmacao-experimental-cron` no `pg_cron`:
- Frequência: **a cada 15 min**, das **06h às 22h BRT** (`*/15 9-1 * * *` em UTC = 06h–22h BRT)
- Todos os dias (inclui fim de semana, já que aulas experimentais podem cair em sábado)
- Chama a edge function via `net.http_post`

---

## 🛡️ Salvaguardas

- **Idempotência**: timestamps em `leads` impedem reenvio.
- **Reagendamento**: trigger reseta os timestamps quando data/hora muda → dispara confirmação nova.
- **Sem telefone**: pula sem erro.
- **Lead matriculado/perdido entre o agendamento e a hora**: não envia.
- **Z-API única**: usa as mesmas envs `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` já configuradas.

---

## 📝 Memória

Salvar `mem://features/confirmacao-experimental-automatica` com regras, templates e janelas, e adicionar no índice.

---

## ❓ Confirmar antes de implementar

1. **Janela de envio**: 06h–22h BRT está bom? (Se a aula for às 7h, o lembrete 24h sai no dia anterior à mesma hora; o de 2h sairia às 5h, antes da janela. Posso estender pra 05h ou aceitar que aulas muito cedo só recebam 24h.)
2. **Fim de semana**: incluir sábado/domingo? (Se houver experimentais nesses dias, sim.)
3. **Trigger de reset** ao reagendar: ok automatizar? (Recomendo sim — evita "esqueci de avisar" se mudou horário.)