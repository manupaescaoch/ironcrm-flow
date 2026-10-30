# Roadmap

- [ ] Bloquear temporariamente Folha de Pagamentos e Ajuda de Custo para todos exceto administradores, sem alterar dados financeiros.

- [x] Separar os dados de pagamento dos avisos de cobrança no Telegram para facilitar copiar e colar.

- [x] Conferir callback OAuth BTG real — função publicada respondeu 400 para pedido sem state; autorização e troca do código usam o mesmo retorno. URL disponível no botão Copiar retorno para o BTG; consentimento real ainda depende das credenciais e cadastro no banco.

- [ ] Conectar DDA do BTG ao Contas a Pagar por unidade — implementar cadastro/consentimento e consulta; concluir após credenciais do aplicativo BTG, autorização real e validação dos boletos importados.

- [x] Corrigir visibilidade e controles da lista de FU de matriculados na Operação.

- [x] Ajustar FU de matriculados e pendentes para dias úteis, com fins de semana transferidos para a semana seguinte sem duplicidade.

- [x] Enviar os follow-ups a realizar aos gerentes pelo Telegram de segunda a sexta.

- [x] Gestão da Rede: separar a meta mensal em Meta Mínima e Supermeta
- [x] Cronograma: campos Prioridade e Setor na nova atividade, edição, edição rápida, edição em lote e detalhes (auditoria já coberta pelo histórico da atividade)
- [x] Formulários operacionais: unidades renomeadas para Madalena, Boa Viagem e Setúbal, com Setúbal habilitado em todos os formulários
- [ ] Etapa 11 EVO OPS: API Hermes (Edge Function segura)
- [ ] Corrigir instância operacional da Z-API (assinatura vencida) para envios automáticos de encerramento

- [ ] Usuário cria bot no BotFather e fornece token; salvar como TELEGRAM_BOT_TOKEN e testar conexão na página Telegram

## Folha – experiência mensal (pedido 29/10)
- [x] Seletor de ano + meses Jan–Dez, status aberta/fechada, rolagem no celular
- [x] Abrir em aba Folha no mês atual, tabela de conferência (PC) e cartões (celular)
- [x] "Preparar folha de [mês]": revisar ativos, criar só lançamentos ausentes, sem copiar variáveis
- [x] Fluxo destacado: preparar → lançar → conferir → fechar → Clara
- [x] Aviso de edições não salvas ao trocar mês/ano/unidade
- [x] Validar com dados fictícios simulados
- [ ] Publicar — aguardando aprovação da interface

## Ajuda de Custo (pedido 29/10)
- [x] Página, menu, cálculo, preparar, fechar próprio, lotes por parcela (preview + pacote pendente)
- [ ] Aplicar banco/função e publicar — aguardando aprovação de Emanuel
