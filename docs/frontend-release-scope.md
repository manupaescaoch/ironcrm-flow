# Escopo de frontend Fases 2–4

Somente candidatos à publicação; não publicar o checkout inteiro.

- Fase 2: mudanças de filtros/busca/concorrência de unidade e retorno persistido em CRM, Kanban e edição básica de LeadDetail, com suas regressões existentes.
- Fase 3: mudanças de períodos, coorte, conversão por treinador, datas e concorrência de unidade nos indicadores e seus helpers/testes; fórmulas financeiras preservadas.
- Fase 4: navegação por papel e gates restritos de App.tsx; ausência de papel nunca monta páginas privilegiadas.
- Homologação final: retirar de useDashboardData somente a chamada de geração ao carregar/trocar período/unidade. Não alterar useDashboardFollowUps, endpoints ou agendadores.

Excluir integralmente funções, SQL/migrações, configurações/secrets, financeiro, novas confirmações FU, Enviado, FC-2A.1 e outras frentes não aprovadas. Arquivos compartilhados contêm trabalho de outras frentes: selecionar os trechos aprovados contra a versão publicada, não copiar arquivos completos indiscriminadamente.

Evidências: 79 testes Bun aprovados (78 existentes + 1 novo); Chromium com login e respostas fictícias, cinco perfis, duas unidades, navegação móvel, períodos e edição/releitura após recarga. Rede externa interceptada; nenhum envio, automação ou gravação hospedada.

Bloqueios: permissões/persistência hospedadas ainda não homologadas; volume de períodos extensos; autorização de publicação e seleção dos trechos contra a versão publicada. Próxima ação: preparar ambiente isolado autorizado para contas/unidades fictícias e aceitar a matriz sem liberar funções pendentes.