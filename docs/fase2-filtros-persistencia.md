# Fase 2 — resultado focado, 04/11/2026

## Problemas reproduzidos e corrigidos
- CRM e Kanban aceitavam resposta atrasada de unidade anterior: geração de requisição e unidade corrente agora impedem substituir a lista; lista limpa na troca e consultas de interações Kanban escopadas à unidade. Reprodução de concorrência executou loaders reais com promises controladas.
- CRM apresentava cadastradores normalizados na opção, mas comparava campo bruto: filtro e contagem usam a mesma normalização existente. Não mudou nomes ou dados armazenados.
- Busca mista nome/telefone ignorava nome quando dígitos coincidiam: agora exige também palavras textuais, preservando telefone formatado.
- Filtro de interesse se perdia ao recarregar/voltar: incluído no snapshot de sessão existente.
- Arquivamento/reativação CRM e edição LeadDetail anunciavam sucesso com zero linhas: exigem retorno persistido de id/unidade/estado. Edição usa linha retornada como baseline; arquivamento retira a linha confirmada mesmo se refresh posterior falhar. Não ampliadas permissões, regras ou RLS.

## Testes e limites
- 27 Bun aprovados (10 regressões novas + 17 testes da Fase 1 preservada), 63 asserções, 0 falhas.
- Reproduções antes/depois: filtros cadastrador/interesse, zero-row arquivamento, zero-row edição, race CRM/Kanban e busca mista.
- Chromium com sessão/transportes fictícios: filtros/recarga, lista da unidade B, cadastro fictício e arquivamento após recarga, escopo dos PATCHs; 7 verificações aprovadas, sem erros de página. Nenhuma chamada externa liberada nem dados reais modificados. Troca de unidade do Layout navega ao dashboard; roteiro retorna ao CRM, respeitando fluxo existente.
- Build automático OK. Alterações funcionais limitadas a CRM, Kanban e edição básica LeadDetail; testes em `src/lib/crmPersistence.bun.test.ts`.
- Perfis/permissões de produção e persistência real não certificados: não houve mutações reais. Zero-row/retornos de autorização foram simulados; RLS existente permanece como autoridade de acesso.
- Importação, mudanças de status por drag, perdas, migração de unidade e interações não foram alteradas: hipóteses de falha parcial/stale timeline não tiveram reprodução completa nesta entrega. Cadastro experimental preservado para não interferir nas automações. Não afirmar auditoria exaustiva de todas as telas.
- Logo não carregou na captura fictícia; sem alteração por estar fora do escopo.

## Preservado
Sem migrations, RLS, publicação, endpoints, Telegram/WhatsApp, confirmações FU, automações, Financeiro, réguas, histórico ou dados reais alterados. Liberação de produção depende de autorização posterior.