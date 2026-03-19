

## Corrigir Estoque: Trigger com unidade_id Errada

### Problema Identificado

O trigger `atualizar_estoque_apos_movimentacao` cria registros em `estoque_interno` **sem incluir `unidade_id`**, fazendo com que o valor default (Zona Norte) seja usado. Resultado:

- **Itens da Zona Sul** (AGUA MINERAL, FLANELINHA AMARELA) têm estoque registrado na Zona Norte por engano
- Quando o frontend consulta `estoque_interno` filtrando por `unidade_id = Zona Sul`, encontra 0
- O Dashboard mostra "Sem Estoque" para itens que na verdade têm saldo

### Evidência

| Insumo | Unidade Real | estoque_interno.unidade_id | quantidade_atual |
|--------|-------------|---------------------------|-----------------|
| AGUA MINERAL | Zona Sul | Zona Norte (errado) | 66 |
| FLANELINHA AMARELA | Zona Sul | Zona Norte (errado) | 37 |

### Plano de Correção

**1. Migration — Corrigir trigger + dados existentes**

Atualizar o trigger para:
- Incluir `unidade_id` no INSERT (usando `NEW.unidade_id` da movimentação)
- Adicionar `AND unidade_id = NEW.unidade_id` no WHERE do SELECT e UPDATE para segurança

Corrigir dados existentes:
- UPDATE `estoque_interno` SET `unidade_id` = insumo's `unidade_id` WHERE eles divergem

**2. Nenhuma alteração no frontend** — o código já filtra por `unidade_id` corretamente

### Resultado
- Novos registros de estoque serão criados com a unidade correta
- Itens ZS voltarão a mostrar o saldo real
- Status preditivo (Sem Estoque/Crítico/Atenção) será calculado corretamente

