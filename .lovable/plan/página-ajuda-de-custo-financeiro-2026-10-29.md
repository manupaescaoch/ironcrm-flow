# Página Ajuda de Custo (Financeiro)

## O que já existe e será reaproveitado
- A ajuda de custo hoje fica dentro do lançamento mensal da Folha. Ela guarda só os valores finais de passagem e alimentação, os ajustes e as duas datas das parcelas, e não entra no salário.
- A divisão em duas parcelas já funciona em centavos: R$ 750,01 vira R$ 375,01 + R$ 375,00.
- A exportação Clara por parcela, com o lote, a prévia, a auditoria e a confirmação de reexportação, já existe para a ajuda. Hoje, porém, ela só funciona depois de **fechar a folha salarial**, porque usa os pagamentos do fechamento do salário.

## O que precisa mudar (inclui banco de dados)
1. **Uma única fonte da ajuda.** Uma tabela própria guardará a ajuda de cada colaborador por unidade e mês, com:
   - passagem por dia, dias úteis, dias adicionais de FDS/feriado;
   - passagem adicional manual (só com motivo; substitui o cálculo, nunca soma de novo);
   - alimentação por dia e dias de alimentação;
   - ajustes positivos ou negativos, com descrição e mês de origem;
   - as datas das duas parcelas.

   A aba de ajuda dentro da Folha passará a ler e gravar nessa mesma tabela. Os dados de ajuda que já existem nos lançamentos da Folha são preservados e lidos como histórico, sem migração automática de valores.
2. **Fechamento próprio da ajuda** por unidade e mês. Ele congela um retrato com valores, PIX e regras, e não depende do fechamento do salário. Meses fechados não mudam com alterações no cadastro.
3. **Exportação Clara da ajuda** passa a usar o retrato desse fechamento, em lotes separados por unidade, mês e parcela, no mesmo modelo XLSX. Bloqueia parcela sem data ou sem valor positivo. Exportar não confirma pagamento.
4. **Ações no servidor** (preparar, salvar, fechar, reabrir, exportar):
   - mesmas permissões da Folha: admin em todas as unidades; gerente só nas unidades vinculadas e nas ações autorizadas;
   - auditoria com autor e valores de antes e depois;
   - CPF e PIX protegidos.

## A página
- **Menu:** Financeiro → Contas a Pagar · Folha de Pagamentos · Ajuda de Custo.
- **Topo:** seletor de ano e meses Jan–Dez, igual ao da Folha. Abrir um mês só consulta.
- **Preparar mês:** você escolhe os colaboradores CLT ativos. Cria só quem falta, sem duplicar. Traz do cadastro apenas a passagem diária, para revisão. Dias, ajustes, datas e pagamentos não são copiados.
- **Tabela no computador e cartões no celular:** todas as colunas pedidas, o total mensal, as duas parcelas com as datas e a situação/pendências.
- **Fórmula:** passagem/dia × dias úteis + passagem/dia × dias adicionais (ou a passagem manual) + alimentação/dia × dias de alimentação + ajustes.
- **Sugestão de dias úteis pelo calendário:** aparece só marcada como "sugestão" e precisa ser confirmada. Nunca é preenchida sozinha.
- **Fluxo em destaque:** Preparar → Revisar → Preencher → Conferir → Fechar ajuda → Exportar parcela 1 ou 2.
- **Planilha enviada:** não é importada nem usada para preencher pessoas reais. Ela serve só de referência para os testes.

## Separação financeira
A ajuda não entra no salário, na comissão, no líquido do contracheque nem no lote salarial. Também não toca Contas a Pagar nem o fluxo de caixa.

## Testes (ambiente isolado com dados fictícios)
- **Cálculos:** R$ 720 (18×19 + 90 + 12×24), R$ 570, R$ 399 e o ajuste de R$ 30 sem repetir no mês seguinte.
- **Parcelas:** a divisão de R$ 750,01.
- **Preparação e fechamento:** preparar duas vezes sem duplicar; fechar a ajuda com o salário aberto.
- **Histórico e lotes:** histórico da Folha preservado; lotes separados por parcela; reexportação com confirmação.
- **Arquivo e acesso:** XLSX reaberto para conferir o formato; isolamento entre unidades.
- **Telas:** computador e celular.

## Limitação importante
Não tenho acesso a um ambiente de homologação com login real neste projeto. Os testes de banco rodarão num Postgres isolado local, como nos ensaios anteriores, e as telas serão testadas com dados simulados no navegador. Login real de gerente não será testado.

## Implantação
Nada será aplicado no banco de produção nem publicado sem a sua aprovação. Entrego as migrações, as evidências e a página pronta no preview.

## Detalhes técnicos
- **Tabelas novas:** `folha_ajuda_lancamentos`, com unique (unidade_id, colaborador_id, competencia), e `folha_ajuda_competencias`, com status, snapshot, regras e fechada_em. Ambas com RLS e grants só para authenticated e service_role, e escrita apenas pela função `folha-operacoes`.
- **Lote Clara da ajuda:** a RPC passa a ler o snapshot de `folha_ajuda_competencias`. O lote salarial não muda.
- **Motor:** novo cálculo puro `calcularAjudaMensal` em `folhaMotor.ts`, com testes. O cálculo antigo `calcularAjudaCusto` continua para os retratos históricos.
