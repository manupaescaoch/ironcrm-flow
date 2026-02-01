
# Plano: Ajuste de Media Manual e Estoque Minimo por Fornecedor

## Contexto Atual

O sistema de estoque atualmente:
1. Calcula a media diaria automaticamente baseada nas retiradas dos ultimos 30 dias
2. Cada insumo tem um `lead_time_dias` fixo (tempo de entrega do fornecedor)
3. O `fornecedor_padrao` e apenas um campo de texto, sem tabela dedicada
4. O Ponto de Pedido e calculado como: `(Lead Time + Estoque Seguranca) x Media Diaria`
5. Nao existe possibilidade de definir media manual quando nao ha historico suficiente

## Problemas Identificados

1. **Insumos novos ou sem retiradas** nao tem media calculada (aparece "Aguardando")
2. **Lead time por fornecedor** esta no insumo, mas o mesmo fornecedor pode ter insumos com lead times diferentes
3. **Nao existe media manual** para produtos sazonais ou com consumo irregular
4. **Falta cadastro centralizado de fornecedores** com seus respectivos lead times

---

## Solucao Proposta

### Fase 1: Tabela de Fornecedores

Criar tabela `fornecedores` para centralizar informacoes:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | Chave primaria |
| unidade_id | uuid | FK para unidades |
| nome | text | Nome do fornecedor |
| lead_time_dias | integer | Tempo de entrega padrao |
| telefone | text | Contato |
| email | text | Email |
| observacoes | text | Notas |
| ativo | boolean | Status |

### Fase 2: Campo de Media Manual no Insumo

Adicionar campos na tabela `insumos`:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| media_diaria_manual | numeric | Media definida manualmente |
| usar_media_manual | boolean | Se deve usar a media manual em vez da calculada |
| fornecedor_id | uuid | FK para tabela fornecedores (opcional, mantem compatibilidade) |

### Fase 3: Alteracoes na Logica de Calculo

Modificar `estoqueCalculations.ts` para:
1. Aceitar parametro `media_diaria_manual`
2. Usar media manual quando `usar_media_manual = true`
3. Continuar usando calculo automatico caso contrario

### Fase 4: Interface do Usuario

**4.1 Modal de Gestao de Fornecedores**
- Novo botao "Fornecedores" no header do estoque
- CRUD completo de fornecedores
- Exibicao do lead time de cada fornecedor

**4.2 Formulario de Edicao do Insumo (Atualizado)**
- Select para escolher fornecedor (puxa lead time automaticamente)
- Campo "Media Diaria Manual" com checkbox "Usar media manual"
- Preview do calculo com a media escolhida

**4.3 AjustarMinimosModal Aprimorado**
- Opcao para considerar media manual quando disponivel
- Preview mostrando qual fonte de media sera usada

---

## Detalhes Tecnicos

### Migracao SQL

```sql
-- Tabela de fornecedores
CREATE TABLE fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id),
  nome text NOT NULL,
  lead_time_dias integer NOT NULL DEFAULT 3,
  telefone text,
  email text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Novos campos em insumos
ALTER TABLE insumos ADD COLUMN media_diaria_manual numeric;
ALTER TABLE insumos ADD COLUMN usar_media_manual boolean DEFAULT false;
ALTER TABLE insumos ADD COLUMN fornecedor_id uuid REFERENCES fornecedores(id);

-- RLS
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

-- Indices
CREATE INDEX idx_fornecedores_unidade ON fornecedores(unidade_id);
CREATE INDEX idx_insumos_fornecedor ON insumos(fornecedor_id);
```

### Calculo Atualizado

```typescript
// Em estoqueCalculations.ts
export interface CalculoEstoqueParams {
  // ... campos existentes
  media_diaria_manual?: number | null;
  usar_media_manual?: boolean;
}

export function calcularMetricasEstoque(params: CalculoEstoqueParams) {
  // Se usar media manual e ela estiver definida
  if (params.usar_media_manual && params.media_diaria_manual && params.media_diaria_manual > 0) {
    media_diaria_raw = params.media_diaria_manual;
  } else {
    // Calculo automatico existente
    media_diaria_raw = calcularMediaDiaria(...);
  }
  // ... resto do calculo
}
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/estoque/FornecedoresModal.tsx` | CRUD de fornecedores |
| `src/hooks/useFornecedores.ts` | Hook para gerenciar fornecedores |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/utils/estoqueCalculations.ts` | Suporte a media manual |
| `src/pages/EstoqueInterno.tsx` | Botao fornecedores, select fornecedor, campos media manual |
| `src/components/estoque/AjustarMinimosModal.tsx` | Preview com fonte da media |
| `src/integrations/supabase/types.ts` | Novos tipos (auto-gerado) |

---

## Fluxo de Uso

1. **Cadastrar Fornecedores**: Admin vai em "Fornecedores" e cadastra DAVISA (lead 1-2 dias), NANITAS (lead 4 dias), SOLDIERS (lead 12 dias)
2. **Associar ao Insumo**: Ao editar insumo, seleciona o fornecedor - lead time e preenchido automaticamente
3. **Definir Media Manual**: Para produtos sem historico, marca "Usar media manual" e define o consumo estimado (ex: 0.5/dia)
4. **Ajustar Minimos**: O modal mostra claramente qual fonte de media esta sendo usada (automatica ou manual)

---

## Beneficios

- Gerenciamento centralizado de fornecedores e seus prazos de entrega
- Media manual para produtos novos ou com consumo irregular
- Lead time consistente por fornecedor em todos os insumos
- Melhor previsibilidade para ambas as unidades (Zona Norte e Zona Sul)
