# Contas a Pagar — nova página no CRM

Página `/contas-a-pagar` dentro do CRM atual: mesmo menu lateral, mesmo cabeçalho, mesma autenticação, mesmas unidades e mesmo padrão visual. Nenhum sistema financeiro paralelo.

## Premissas (corrija se estiver errado)

- "Comercial" no sistema é o papel `user` no banco (o CRM traduz `user` → comercial). As ações restritas (baixa, editar, cancelar, reabrir, excluir logicamente) ficam para `admin` + `comercial`.
- Anexos (boleto/nota/comprovante) irão para um bucket privado novo `contas-pagar-docs`, com acesso por unidade, no mesmo padrão já usado em Reuniões/Rotinas.
- A leitura do texto colado será feita por um analisador determinístico no próprio app (regex + decodificação do payload Pix EMV, que já traz nome do favorecido e valor). Sem custo de IA e sem enviar dados para fora.

## Banco de dados

Tabela `contas_pagar` (unidade_id obrigatório, descrição, fornecedor, categoria, prioridade, centro de custo, competência, observações, valor, data de vencimento, forma de pagamento, número da fatura, código de barras, linha digitável, chave Pix, código Pix copia e cola, documento, status base `pendente | paga | cancelada`, valor pago, data do pagamento, juros, multa, desconto, comprovante, quem cadastrou, quem deu baixa, datas, `deleted_at` para exclusão lógica).

Tabela `contas_pagar_historico`: conta, ação (criação, edição, valor, vencimento, baixa, reabertura, cancelamento, exclusão), campo, valor anterior, valor novo, usuário, data/hora — preenchida por trigger.

Segurança no backend (RLS + GRANTs):
- Leitura: admin em todas as unidades; demais apenas nas unidades vinculadas (`get_user_unidades`). Sem vínculo = nada.
- Inserção: qualquer usuário autenticado, apenas na própria unidade, sempre com `created_by = auth.uid()`.
- Atualização/exclusão lógica: somente `admin` ou `user` (comercial), e ainda assim restrita à unidade permitida.
- Trocar unidade pela URL ou pelo payload não dá acesso: a checagem é feita no banco, não na tela.
- Status `vencendo hoje` e `atrasada` são derivados da data (nunca gravados/escolhidos manualmente).

## Tela

- Item **Contas a Pagar** no menu lateral, logo abaixo de Comissões, visível para todos os papéis.
- Cabeçalho com título e três botões: Nova Conta, Importar por texto, Exportar PDF.
- 4 cards de resumo: Total do Mês, Vencendo Hoje, Pago no Período, Atrasadas (valor + quantidade), sempre recalculados conforme unidade, período e filtros.
- Seleção de período: Por mês (ano + Jan–Dez, iniciando no mês/ano atual), Por semana, Esta semana, Período personalizado — com a linha "Período: 01/08/2026 até 31/08/2026".
- Busca ("Buscar descrição ou fornecedor...") cobrindo descrição, fornecedor, categoria, número da fatura e observações; filtros de status, categoria, prioridade e forma de pagamento.
- Listagem: tabela no desktop (Descrição, Fornecedor, Categoria, Vencimento, Valor, Forma de pagamento, Prioridade, Status, Cadastrado por, Ações) e cards no celular. Vazio: "Nenhuma conta encontrada para o período selecionado."

## Modais

1. **Nova Conta** — dois blocos (Informações gerais / Dados financeiros) com os campos e obrigatoriedades pedidos, categorias sugeridas da lista, unidade preenchida e bloqueada, padrão Prioridade Normal e Status Pendente, upload de documento.
2. **Importar Conta a Pagar** — unidade atual, caixa de texto grande, texto de orientação e placeholder do exemplo TIM, botões Analisar dados / Cancelar. Se o texto citar outra unidade: alerta com as opções corrigir texto / continuar com a unidade selecionada / cancelar (usuário comum nunca troca de unidade).
3. **Confirme os dados da conta** — todos os campos editáveis, unidade bloqueada para usuário comum, campos obrigatórios faltantes destacados, botões Voltar para o texto / Cancelar / Confirmar cadastro. O código Pix é salvo integralmente, sem alteração.
4. **Sucesso** — "Conta cadastrada com sucesso!" com resumo (descrição, valor, vencimento, forma de pagamento, unidade, status) e botões Ver conta cadastrada / Cadastrar outra conta / Fechar, mais o toast no canto.
5. **Possível duplicidade** — checagem por unidade + descrição/valor/vencimento/código Pix/linha digitável/número da fatura, exibindo a conta existente com Ver conta existente / Cancelar / Cadastrar mesmo assim (este último só para admin e comercial).
6. **Dar baixa** (só admin/comercial) — valor original, valor pago, data do pagamento, forma de pagamento, juros, multa, desconto, comprovante, observações; obrigatórios: valor pago, data e forma. Ao confirmar, status vira Paga com registro de quem e quando.
7. **Detalhes** — painel com todos os dados, documentos, histórico completo e botões de copiar chave Pix / código Pix / linha digitável, ver documento e dar baixa quando permitido.

## Comportamento

Botões restritos não aparecem para quem não tem permissão (e o backend recusa mesmo assim). Botões travam durante o envio para evitar cadastro duplo por cliques repetidos, com estado de carregamento, mensagens de erro claras e atualização da lista e dos cards sem recarregar a página. Layout responsivo em desktop, tablet e celular.

## Detalhes técnicos

- Migração SQL: enums de status/prioridade/forma de pagamento, `contas_pagar`, `contas_pagar_historico`, trigger de `updated_at`, trigger de auditoria, função `has_role`/`get_user_unidades` reutilizadas, GRANTs e políticas RLS por unidade e papel.
- Bucket privado `contas-pagar-docs` + políticas em `storage.objects` baseadas na unidade da conta.
- Arquivos: `src/pages/ContasPagar.tsx`, rota em `App.tsx`, item no `Layout.tsx`, `src/hooks/useContasPagar.ts`, `src/lib/parseContaTexto.ts` (parser de texto + Pix EMV), e componentes em `src/components/contas-pagar/` (KPIs, filtros/período, tabela, cards mobile, NovaContaModal, ImportarTextoModal, ConferenciaStep, DuplicidadeDialog, BaixaModal, DetalhesDrawer, export PDF com jsPDF já usado em Comissões).
- Dados via React Query com invalidação após cada mutação; todas as consultas filtradas por `unidade_id` da unidade selecionada.
