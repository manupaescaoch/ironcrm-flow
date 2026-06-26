# Classificação de Lead por Nível de Interesse

## Situação atual

O CRM já tem um **score automático 0–100** (`useConversionScore`) que classifica em 🔥 Quente / ☀️ Morno / ❄️ Frio / 🧊 Improvável usando origem, etapa, comparecimento, nº de interações e tempo no funil. Hoje esse rótulo aparece no Kanban e no detalhe do lead, mas **não é editável** e **não pode ser filtrado** na lista do CRM.

Falta a percepção humana — o consultor que conversou com o lead muitas vezes sabe melhor do que a fórmula se ele está "quente". A proposta combina os dois.

## O que será feito

### 1. Campo manual de interesse no lead
Nova coluna `nivel_interesse` em `leads` com 4 níveis:
- 🔥 **Alto** — pronto para fechar, decisão iminente
- ☀️ **Médio** — interessado, ainda avaliando
- ❄️ **Baixo** — frio, sem urgência
- ⚪ **Não classificado** (padrão)

Editável por qualquer usuário com acesso à unidade do lead. Registra `nivel_interesse_atualizado_em` e `nivel_interesse_atualizado_por` para auditoria.

### 2. Score combinado (automático + manual)
Quando o consultor marcar manualmente, o **manual prevalece** sobre o automático (vira "fonte da verdade"). Se estiver "Não classificado", o sistema usa o score automático já existente como sugestão e mostra um botão "Confirmar sugestão" para promover ao manual com 1 clique.

### 3. UI no detalhe do lead
Substituir o `ConversionScoreCard` por uma seção única "Nível de Interesse" com:
- Seletor de nível (4 botões grandes coloridos)
- Score automático mostrado como **sugestão** abaixo
- Última atualização ("Marcado como Alto por João em 12/06")
- Fatores positivos e pontos a melhorar (mantém o atual)

### 4. Badge no Kanban e no CRM
- Kanban: badge colorido do nível manual; se não houver, mantém o badge de score automático em cinza claro
- CRM (lista): nova coluna "Interesse" ordenável + chip de filtro rápido ("🔥 Alto", "☀️ Médio", "❄️ Baixo", "⚪ Sem nível")

### 5. Regras de transição
- Lead `convertido` ou `perdido` → nível some da UI (não faz sentido classificar)
- Ao marcar `perdido`, limpar `nivel_interesse` automaticamente
- Ao mudar para `aula_realizada` sem nível manual, sugerir "Alto" se compareceu

### 6. Indicador no dashboard
Card novo em Dashboard: "Distribuição de Interesse" com 3 barras (Alto/Médio/Baixo) por unidade — ajuda a coordenação a ver quantos leads quentes a equipe tem na carteira.

## Detalhes técnicos

**Banco:**
- Migration adiciona em `leads`: `nivel_interesse text` (check em 'alto','medio','baixo' ou null), `nivel_interesse_atualizado_em timestamptz`, `nivel_interesse_atualizado_por text`
- Atualiza `enforce_leads_update_permissions` para permitir alteração desses 3 campos por qualquer usuário com `user_has_unidade_access`
- Trigger limpa `nivel_interesse` quando `status_funil` muda para `perdido`

**Front:**
- `src/hooks/useConversionScore.ts`: expor `nivelEfetivo` que retorna o manual se houver, senão o derivado do score (>=80 alto, >=60 médio, resto baixo)
- Novo `src/components/NivelInteresseSelector.tsx`: 4 botões grandes (Alto/Médio/Baixo/Limpar)
- `LeadDetail.tsx`: trocar `ConversionScoreCard` pelo novo bloco unificado
- `Kanban.tsx`: novo `NivelInteresseBadge` lendo `nivelEfetivo`
- `CRM.tsx`: nova coluna + chips de filtro rápido por nível

**Alternativa considerada e descartada:** automatizar 100% sem campo manual. Descartada porque a fórmula não captura sinais qualitativos da conversa (objeção, urgência, sondagem de preço) — o consultor precisa do controle final.

## Fora deste plano
- Editar pesos do score automático via tela admin (continuam hardcoded)
- Histórico completo de mudanças de nível (registra só a última)
- Automação WhatsApp baseada em nível (pode entrar depois)
