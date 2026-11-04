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
