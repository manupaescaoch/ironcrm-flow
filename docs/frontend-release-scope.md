# Escopo de frontend Fases 2–4

Somente candidatos à publicação; não publicar o checkout inteiro.

- Fase 2: mudanças de filtros/busca/concorrência de unidade e retorno persistido em CRM, Kanban e edição básica de LeadDetail, com suas regressões existentes.
- Fase 3: mudanças de períodos, coorte, conversão por treinador, datas e concorrência de unidade nos indicadores e seus helpers/testes; fórmulas financeiras preservadas.
- Fase 4: navegação por papel e gates restritos de App.tsx; ausência de papel nunca monta páginas privilegiadas.
- Homologação final: retirar de useDashboardData somente a chamada de geração ao carregar/trocar período/unidade. Não alterar useDashboardFollowUps, endpoints ou agendadores.

Excluir integralmente funções, SQL/migrações, configurações/secrets, financeiro, novas confirmações FU, Enviado, FC-2A.1 e outras frentes não aprovadas. Arquivos compartilhados contêm trabalho de outras frentes: selecionar os trechos aprovados contra a versão publicada, não copiar arquivos completos indiscriminadamente.

Evidências: 79 testes Bun aprovados (78 existentes + 1 novo); Chromium com login e respostas fictícias, cinco perfis, duas unidades, navegação móvel, períodos e edição/releitura após recarga. Rede externa interceptada; nenhum envio, automação ou gravação hospedada.

Pacote separado em `docs/frontend-package/`: oito patches históricos/novos e três adições, aplicados sem conflitos contra a referência local `origin/_agent-publish`; nenhuma função, migration, configuração ou alteração de permissões incluída. O checkout inteiro não é esse pacote. Referência de publicação local, não comprovação do conteúdo servido no domínio.

Totais: sete loaders de indicadores usam páginas de 500 com contagem exata e ordenação, preservando filtros e fórmulas; erros/cortes e mudança de contagem não retornam totais parciais. Se o Dashboard não concluir todas as leituras, mantém os totais ocultos e informa a falha. Seis testes novos aprovados; os 79 anteriores não foram repetidos.

Prévia: criação de rascunho é suportada, mas nenhum rascunho existe ou foi criado. Um rascunho parte do projeto principal inteiro, não de uma seleção de patches; é necessário montar o candidato separado nele e confirmar que recebeu banco de teste próprio (a plataforma pode usar o banco principal se o isolamento falhar). Nenhuma homologação hospedada foi executada ou simulada.

Bloqueios: montar o pacote no rascunho, confirmar isolamento e homologar permissões/persistência com cinco perfis e duas unidades fictícias; obter autorização posterior de publicação. Enviado/FC-2A.1 continuam excluídos; agendadores intocados.