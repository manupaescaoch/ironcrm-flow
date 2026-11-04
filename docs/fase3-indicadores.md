# Fase 3 — Indicadores e cálculos (04/11/2026)

## Erros comprovados e corrigidos
1. Dashboard Executivo: "Últimos 7/30 dias" somavam 8/31 dias.
2. Dashboard: conversão no mesmo dia dependia da ordem das experimentais (lead com duas presenças perdia a conversão).
3. Dashboard Operacional: encerramentos entre 21h e 23h59 (Recife) ficavam fora do último dia do período.
4. Comissões: resposta atrasada da unidade anterior substituía a unidade selecionada.

## Testes
`src/lib/indicadores.bun.test.ts` + regressões existentes: 24 passaram, 0 falhas. Dados fictícios; sem banco/rede.

## Pendências (não comprovadas, não alteradas)
- Possível corte de 1000 linhas em totais sem paginação (volume real não verificado).
- Denominador de conversão por treinador nas comissões.
- Coorte do Executivo (leads novos x interações de leads antigos) — depende da regra desejada.
- Persistência de filtros após recarga nos dashboards.

Sem migrations, RLS, publicação ou dados reais alterados.

## Finalização (04/11/2026)
- Executivo: novo card "Coorte → Aluno" (leads captados no período com is_matriculado/convertido ÷ leads captados). Card "Matrículas" mantém a fórmula atual (matrículas por interação no período, qualquer captação), agora rotulado "Realizadas no período". Mudança aditiva: Atend.→Aluno, PDF, metas, comissões e demais telas inalterados.
- Visual (dados fictícios): Coorte 75% (3/4), Matrículas 2 incluindo lead antigo.
- Limite 1.000: maior volume real por unidade/mês ≈ 340 interações; períodos mensais não atingem. Risco apenas em períodos personalizados > ~3 meses (não corrigido).
- Conversão por treinador (Comissões): comprovado que a base usa só interações com matrícula, logo tende a 100%. Bônus não depende dela. Correção aguarda aprovação.
- Filtros: nenhum dashboard persiste filtros após recarga; é comportamento atual, não regressão.
- Testes: 30 passaram, 0 falhas.

## Encerramento (04/11/2026)
- Comissões: conversão por treinador = alunos únicos com experimental realizada pelo treinador no mês que se matricularam ÷ alunos únicos com experimental realizada (compareceu) pelo treinador no mês × 100. Denominador zero = 0%. Matrículas, bônus e comissões inalterados.
- Executivo: título "Coorte → Aluno" não é mais cortado.
- Visual com dados fictícios em duas unidades: Executivo, Dashboard, Operacional e Comissões sem erro; unidades isoladas (A: JOAO 4 aulas/2 matrículas/50%; B: MARIA 1/1/100%); bônus R$ 20/aluno mantido.
- Testes: 34 passaram, 0 falhas.
- Fase 3 concluída em desenvolvimento; publicação pendente da homologação final.
