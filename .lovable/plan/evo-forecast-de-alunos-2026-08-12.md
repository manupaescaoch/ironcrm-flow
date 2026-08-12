# EVO | Forecast de Alunos

Nova página gerencial (somente admin) em `/forecast`, dentro do grupo **Gerencial** do menu, com todos os dados isolados por unidade, mês e ano.

Lógica central: Tráfego → Leads → Experimentais → Comparecimentos → Matrículas → Evasões → Crescimento líquido → Base ativa → Receita.

## Decisões já definidas
- Acesso: apenas admin (rota admin + leitura/escrita restritas no banco).
- Base de alunos ativos: campo próprio do Forecast (informado por unidade/mês), não puxa do CRM.
- Conversas iniciadas: lançamento manual mensal.
- Fechar mês e reabrir mês: apenas admin.

## Estrutura da página (nesta ordem)
1. **Cabeçalho**: título, subtítulo, filtros (Unidade, Mês, Ano), botões *Atualizar projeção* e *Fechar mês*.
2. **Cards executivos**: alunos ativos, meta, capacidade, ocupação %, crescimento líquido do último mês, matrículas do último mês, taxa de evasão, CAC, receita recorrente estimada.
3. **Leitura do Forecast**: até 5 insights automáticos (crescimento, evasão, gargalo do funil, tráfego necessário, capacidade), textos curtos e gerenciais.
4. **Real do último mês fechado**: aquisição, financeiro e base. Cada campo marcado visualmente como **Automático** (vindo do CRM) ou **Manual**.
5. **Eficiência do funil**: custo por conversa, aproveitamento do atendimento, CPL, Lead→Experimental, comparecimento, Experimental→Matrícula (denominador = comparecimentos), CAC via tráfego, evasões, taxa de evasão e crescimento líquido — com sinalização verde/amarelo/vermelho conforme metas da unidade.
6. **Premissas da projeção**: editáveis (investimento, CPL, conversões, evasão, mensalidade média, base inicial, capacidade, meta) com preenchimento padrão pelos dados reais mais recentes e opção *média dos últimos 1 / 3 / 6 meses*.
7. **Forecast do próximo mês**: leads, experimentais, comparecimentos, matrículas, evasões, crescimento líquido, alunos ativos, CAC, receita, distância para meta (ou "meta superada em X alunos") e ocupação projetada.
8. **Projeção 12 meses**: tabela encadeada (base final vira base inicial do mês seguinte), coluna Evolução com barra de progresso até a capacidade, linha TOTAL 12 MESES e gráfico de linhas (base projetada, meta, capacidade) com marcadores de meta atingida e 80/90/100% da capacidade.
9. **Meta reversa**: gestor informa meta e prazo; sistema calcula crescimento líquido, matrículas, comparecimentos, experimentais, leads, conversas e investimento necessários, além do investimento adicional.
10. **Cenários de meta**: Conservador / Base / Agressivo, todos calculados a partir das premissas atuais e editáveis (meta, prazo, CPL, conversões, evasão) com recálculo imediato.
11. **Acompanhamento semanal** (semana comercial segunda→sexta): tabela com no mínimo 13 semanas, taxa de evasão semanal, média móvel de 4 semanas, equivalente mensal, linha MÉDIA DO PERÍODO, meta de evasão mensal no topo e classificação DENTRO DA META / ATENÇÃO / ACIMA DA META.
12. **Simulador de alavancas**: +10% investimento, −10% CPL, +10 p.p. Lead→Exp, +10 p.p. comparecimento, +5 p.p. conversão, −1 p.p. evasão — mostrando matrículas adicionais/mês, crescimento líquido adicional, alunos adicionais e receita adicional em 12 meses.
13. **Histórico da base**: mês, alunos ativos, novas matrículas, taxa de evasão, evasões, crescimento líquido, crescimento %. Meses fechados nunca mudam retroativamente.

Design: padrão visual atual do EVO, aparência de dashboard executivo, cards com espaçamento amplo, valores destacados, gráficos simples, barras de progresso, cores apenas como sinalização, tooltips explicativos em cada indicador (CPL, CAC, comparecimento, EXP→MAT, crescimento líquido, evasão). Responsivo em desktop e mobile.

## Regras de cálculo
- Percentuais guardados internamente em decimal (70,2% = 0,702).
- Arredondamento: pessoas inteiro, dinheiro 2 casas, percentuais 1 casa.
- Nunca dividir por zero, nunca exibir NaN, nunca evasões acima da base, nem negativos impossíveis.
- Se a projeção passar da capacidade: alerta **CAPACIDADE PROJETADA EXCEDIDA**, gráfico limitado visualmente à capacidade, número projetado preservado para mostrar demanda reprimida.
- Ao fechar o mês: grava o fechamento no histórico, a base final passa a ser base inicial do mês seguinte, as médias do forecast são atualizadas e os 12 meses recalculados.

## Detalhes técnicos
- **Banco**: as tabelas `forecast_premissas`, `forecast_realizado`, `forecast_metas` e `forecast_cenarios` já existem e serão reutilizadas. Uma migração vai:
  - adicionar a `forecast_realizado` os campos ainda ausentes (leads no CRM, experimentais marcadas, comparecimentos, matrículas totais, matrículas via tráfego, ticket médio, alunos ativos informados, status fechado/aberto, data e autor do fechamento);
  - adicionar a `forecast_premissas` os campos meta de alunos, CPL projetado e mensalidade média;
  - criar tabela de acompanhamento semanal do forecast (segunda, matrículas, cancelamentos, sexta) por unidade/semana;
  - restringir todas essas tabelas a admin (leitura e escrita) com GRANTs corretos;
  - impedir alteração de mês já fechado, liberando somente a reabertura por admin.
- **Dados automáticos**: leads cadastrados, experimentais marcadas, comparecimentos, matrículas e ticket médio são lidos do CRM (`leads` / `interacoes`) filtrados por `unidade_id` e mês; investimento vem de `investimentos_marketing`. Conversas iniciadas, cancelamentos reais e base de alunos são manuais.
- **Frontend**: `src/pages/Forecast.tsx` + componentes em `src/components/forecast/`, cálculo puro em `src/lib/forecast.ts` (funções testáveis, sem acesso a dados), hooks `useForecastData` / `useForecastPremissas` / `useForecastSemanal`. Gráficos com Recharts, já usado no projeto. Rota admin em `App.tsx` e item no grupo Gerencial do `Layout.tsx`.
- Datas construídas com `new Date(ano, mes-1, dia)` para evitar desvio de fuso.
