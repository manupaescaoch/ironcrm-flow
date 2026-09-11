# API de Alunos (somente leitura)

Endpoint público protegido por chave secreta, para consumo por outro sistema.

## URL

```
GET https://zspcdvtdgssabpqrybib.functions.supabase.co/alunos-api
```

Somente `GET`. Qualquer outro método retorna `405`.

## Autenticação

Envie a chave em um dos dois headers:

```
x-api-key: <valor de ALUNOS_API_KEY>
```
ou
```
Authorization: Bearer <valor de ALUNOS_API_KEY>
```

- Sem chave ou chave errada: `401 {"error":"Unauthorized"}`
- A chave está armazenada apenas no backend deste projeto, com o nome **`ALUNOS_API_KEY`**.
- No projeto consumidor, guarde o mesmo valor como segredo de backend (nome sugerido: `ALUNOS_API_KEY`). Nunca no frontend.

## Parâmetros (query string)

| Parâmetro | Padrão | Descrição |
|---|---|---|
| `limit` | `200` | 1 a 1000 registros por página |
| `offset` | `0` | Deslocamento para paginação |
| `unidade_id` | — | UUID da unidade; inválido retorna `400` |
| `incluir_anamnese` | `false` | `true`/`1`/`sim` adiciona a última anamnese de cada aluno |
| `incluir_nao_matriculados` | `false` | `true`/`1`/`sim` inclui leads ainda não matriculados |

## Exemplos

```bash
# Alunos matriculados (padrão)
curl -H "x-api-key: $ALUNOS_API_KEY" \
  "https://zspcdvtdgssabpqrybib.functions.supabase.co/alunos-api?limit=200"

# Com anamnese e incluindo não matriculados
curl -H "x-api-key: $ALUNOS_API_KEY" \
  "https://zspcdvtdgssabpqrybib.functions.supabase.co/alunos-api?incluir_anamnese=true&incluir_nao_matriculados=true"

# Filtrando por unidade
curl -H "x-api-key: $ALUNOS_API_KEY" \
  "https://zspcdvtdgssabpqrybib.functions.supabase.co/alunos-api?unidade_id=<uuid>"
```

## Resposta

```json
{
  "total": 787,
  "limit": 200,
  "offset": 0,
  "alunos": [
    {
      "id": "0f3c...",
      "nome": "MARIA SILVA",
      "telefone": "81999998888",
      "status": "ativo",
      "matriculado": true,
      "unidade": { "id": "a1b2...", "nome": "BOA VIAGEM" }
    }
  ]
}
```

`unidade` pode ser `null`. `status` é `"ativo"` ou `"inativo"`.

Com `incluir_anamnese=true`, cada aluno ganha o campo `anamnese` (ou `null`):

```json
"anamnese": {
  "respondida_em": "2026-08-30T12:00:00Z",
  "nome": "MARIA SILVA",
  "data_nascimento": "1990-05-10",
  "objetivo": "...",
  "historico": "...",
  "frequencia_atual": "...",
  "obstaculo": "...",
  "dias_semana": "...",
  "preferencia_horario": "...",
  "tem_condicao_saude": false,
  "condicao_saude_descricao": null,
  "tem_lesao": false,
  "lesao_descricao": null,
  "observacoes": null
}
```

## Paginação

Percorra usando `offset += limit` até `offset >= total`.

## Códigos de erro

| Código | Significado |
|---|---|
| `400` | `unidade_id` inválido |
| `401` | Chave ausente ou incorreta |
| `405` | Método diferente de `GET` |
| `500` | Erro interno / chave não configurada no servidor |

## Segurança

- Somente leitura: a função executa apenas consultas `select`; nenhuma escrita é possível.
- Chaves de banco e service role permanecem apenas no backend, nunca expostas na resposta.
- Comparação da chave em tempo constante, para evitar ataques de temporização.
