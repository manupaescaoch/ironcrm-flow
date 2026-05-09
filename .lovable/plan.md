# Anamnese da Aula Experimental

Formulário multi-etapas premium, mobile-first, aberto a partir da página do lead no CRM, com respostas vinculadas ao lead e envio automático de resumo para o grupo de WhatsApp.

## 1. Estrutura de dados

Nova tabela `anamneses_experimental`:

- `id` uuid PK
- `lead_id` uuid (FK lógica → leads.id)
- `unidade_id` uuid
- `nome` text
- `objetivo` text
- `historico` text
- `frequencia_atual` text
- `obstaculo` text
- `dias_semana` text
- `preferencia_horario` text[] (multi-seleção)
- `tem_condicao_saude` boolean
- `condicao_saude_descricao` text
- `tem_lesao` boolean
- `lesao_descricao` text
- `observacoes` text
- `preenchido_por` uuid (auth.uid)
- `created_at`, `updated_at`

Constraint UNIQUE em `lead_id` para evitar duplicidade (upsert atualiza a anamnese existente do lead).

RLS: SELECT/INSERT/UPDATE para usuários autenticados com acesso à `unidade_id` do lead (mesmo padrão das demais tabelas, via `user_has_unidade_access`/`has_role admin`).

## 2. Rota e navegação

- Rota nova: `/lead/:id/anamnese` (protegida, dentro do CRM, sem layout/menu lateral — tela cheia mobile).
- Em `LeadDetail.tsx`: botão "Responder Anamnese" (destaque azul) no topo do card do lead. Se já existir anamnese, mostra "Editar Anamnese" + badge "Anamnese preenchida".
- Nova seção "Anamnese da Aula Experimental" em `LeadDetail.tsx` exibindo todas as respostas (campos vazios = "Não informado").

## 3. Componentes (novos arquivos)

```text
src/pages/AnamneseExperimental.tsx        // wrapper de rota, carrega lead
src/components/anamnese/AnamneseWizard.tsx // controla etapas e estado
src/components/anamnese/AnamneseIntro.tsx  // tela inicial azul
src/components/anamnese/AnamneseFinal.tsx  // tela final azul
src/components/anamnese/StepShell.tsx      // barra topo IRON CLUB + progresso + contador + botões
src/components/anamnese/OptionCard.tsx     // card branco selecionável (emoji em círculo + label)
src/components/anamnese/steps/Step1Nome.tsx ... Step10Observacoes.tsx
src/components/lead/AnamneseSection.tsx    // exibição das respostas no LeadDetail
```

## 4. Design system (sem cores hardcoded em componentes)

Adicionar em `src/index.css` tokens HSL:

- `--anamnese-royal` (azul royal intenso)
- `--anamnese-royal-foreground`
- `--anamnese-bg` (cinza claro do corpo)
- `--anamnese-card` (branco)
- `--anamnese-border-selected` (azul principal)
- `--anamnese-muted-foreground`

Mapear em `tailwind.config.ts` como `anamnese.royal`, `anamnese.bg`, etc.

Tipografia: importar via Google Fonts no `index.html` uma display condensada pesada (ex.: **Barlow Condensed 800/900**) para títulos da intro/final e **Inter** para corpo. Classe utilitária `.font-display-condensed`.

Componentes seguem shadcn (Button, Input, Textarea, Progress) com variantes próprias quando necessário; respeitar regra de uppercase de inputs (já default no projeto).

## 5. Wizard — comportamento

- Estado central no `AnamneseWizard` (`useState` com objeto de respostas) + step atual.
- `StepShell` recebe: `stepNumber`, `totalSteps=10`, `categoria`, `pergunta`, `apoio`, `canContinue`, `onBack`, `onContinue`, children.
- Barra de progresso: `<Progress value={(step/total)*100} />`.
- Botão "Continuar" fixo (`fixed bottom-0` com safe-area), desabilitado até resposta obrigatória.
- Botão "Voltar" `variant="ghost"` abaixo (oculto na etapa 1).
- Etapas 8 e 9 expandem campo de descrição condicional ao "Sim".
- Etapa 7 permite múltipla seleção (array).
- Pré-preenche `nome` com `lead.nome` na etapa 1.
- Mobile-first: layout `max-w-md mx-auto`, padding generoso, cards com `rounded-2xl`, `shadow-sm`, borda 2px ao selecionar (`border-anamnese-royal`).

## 6. Tela inicial e final

Intro: viewport inteiro `bg-anamnese-royal`, texto branco, "IRON CLUB · {unidade}" no topo, título display em 3 linhas, apoio, "Leva menos de 2 minutos ⚡", botão "Começar" branco com texto azul.

Final: mesmo fundo, "ANAMNESE FINALIZADA.", apoio, botão "Salvar anamnese" → executa upsert + chama edge function de WhatsApp + redireciona para `/lead/:id` com toast de sucesso.

## 7. Envio para WhatsApp

Nova edge function `notify-anamnese-experimental`:

- Input: `{ anamnese_id }`.
- Carrega anamnese + lead (nome, unidade, data_aula_experimental).
- Monta a mensagem exatamente no template fornecido (campos vazios → "Não informado").
- Lê o número/grupo do WhatsApp da configuração existente da unidade (mesmo padrão usado em `notify-feedback-experimental` / `notify-boas-vindas-matricula`). Se não existir config dedicada, reutiliza o grupo configurado para a unidade.
- Envia via Z-API usando os secrets já existentes (`ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`).
- Retorna `{ ok: true }`. Falha de envio não bloqueia salvamento (mostra toast de aviso).

`config.toml`: registrar a função (verify_jwt default).

## 8. Regras funcionais aplicadas

- Acesso somente via página do lead (rota requer `:id` válido; bloqueia se lead não pertencer à unidade do usuário).
- Não cria lead novo — sempre upsert por `lead_id`.
- Respostas opcionais salvas como `null`; renderização exibe "Não informado".
- Inputs em uppercase exceto descrições livres? Seguir regra global do projeto: `Input`/`Textarea` já aplicam uppercase automaticamente (mantém consistência).
- Botão "Continuar" desabilitado sem resposta obrigatória; etapas 7 e 10 são opcionais (podem pular).

## 9. Entregáveis

1. Migração: tabela `anamneses_experimental` + RLS + índice único em `lead_id`.
2. Tokens de design e fonte display.
3. Páginas/componentes do wizard + intro + final.
4. Integração no `LeadDetail` (botão + seção de exibição).
5. Edge function `notify-anamnese-experimental` + entrada no `config.toml`.
6. Memory update: nova entrada referenciando o fluxo da Anamnese Experimental.
