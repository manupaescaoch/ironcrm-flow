

## Buscar grupos do WhatsApp via Z-API no FormularioBuilder

Criar uma edge function que lista os grupos do WhatsApp conectados à instância Z-API e usar essa lista como select no campo "WhatsApp do Grupo para Respostas".

### Edge Function: `list-whatsapp-groups`

Novo arquivo `supabase/functions/list-whatsapp-groups/index.ts`:
- Chama a API Z-API: `GET https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/chats` (filtrando `isGroup: true`)
- Retorna array `[{ id, name }]` com ID e nome de cada grupo
- Requer autenticação (apenas admin)
- CORS headers padrão

Configurar `verify_jwt = false` no `supabase/config.toml`.

### Alterações no FormularioBuilder

- Ao carregar o componente, invocar `supabase.functions.invoke('list-whatsapp-groups')` para buscar a lista de grupos
- Substituir o `<Input>` do campo "WhatsApp do Grupo" por um `<Select>` com as opções vindas da API
- Cada opção mostra o nome do grupo e salva o ID do grupo no banco
- Fallback: se a chamada falhar, manter o input manual como está hoje

### Arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/list-whatsapp-groups/index.ts` | Novo |
| `supabase/config.toml` | Adicionar `[functions.list-whatsapp-groups]` |
| `src/components/cronograma/FormularioBuilder.tsx` | Trocar Input por Select com grupos do WhatsApp |

