## Atualizar mensagem do follow-up D+30

Substituir o template atual do D+30 nos dois cards do dashboard que oferecem o envio via WhatsApp pelo novo texto fornecido.

### Novo texto

```
Oi, {nome}!

Passando pra deixar o contato aberto. Se em algum momento quiser treinar com mais acompanhamento e uma experiência diferente, a Iron está aqui.

Qualquer coisa é só chamar. 🤝
```

### Arquivos alterados

- `src/components/dashboard/UnifiedFollowUpCard.tsx` (linhas 53–59) — substituir o bloco do `'D+30'` no objeto de templates.
- `src/components/dashboard/AutoFollowUpCard.tsx` (linhas ~75) — substituir o bloco do `'D+30'` no objeto de templates.

Manter o placeholder no formato `{{nome}}` (já é o padrão usado pelos outros templates e pela função de envio), só trocando o conteúdo do texto.

### Memória

Atualizar `mem://features/experimental-follow-up-templates` registrando o novo texto oficial do D+30.

### Fora de escopo

- Não alterar templates de D+1, D+7 e D+15.
- Não criar envio automático (segue manual via botão WhatsApp).
