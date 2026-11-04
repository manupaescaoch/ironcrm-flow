# Backup e recuperação — Fase 1F

## Evidência disponível
O usuário informou o snapshot diário **04/11/2026 04:49:58 UTC**. Não há ferramenta para consultar o inventário, conferir checksum, validar integridade do arquivo interno ou restaurar esse snapshot em outro ambiente. Não foi feita restauração; integridade e recuperabilidade **não comprovadas**. A cópia estrutural ensaiada na Fase 1E não prova recuperação de dados, usuários ou desse backup.

Backups diários cobrem schema e dados do banco, com aproximadamente 14 dias de retenção; não incluem arquivos de Storage. Não há recuperação a um instante arbitrário entre snapshots. A página More → Database → Manage → Backups restaura somente o mesmo projeto, em produção, não um ambiente isolado. Não executar para homologação.

## Alternativa documentada de recuperação isolada
1. Com backend ativo, acessar More → Database → Manage → Settings → Export project data → Export data; no cartão Database, Export → Start export.
2. Baixar o arquivo pelo link enviado por e-mail ou em More → Storage. Não anexar o export ao chat: contém dados pessoais e hashes de senha. Limites: banco até 15 GB, arquivo até 5 GB, um export a cada 24 horas.
3. Restaurar o export em um projeto separado de banco compatível pertencente ao usuário, com acesso restrito. Não há importação pela página de exportação do Lovable Cloud nem restauração de snapshot diário em outro Cloud por essa página.
4. Isolar conexões externas antes de usar o destino: sem tokens de canais, crons ativos ou webhooks de produção. Restaurar configurações de provedores de login/API necessárias separadamente; elas não fazem parte do export. Não usar credenciais reais em testes.
5. Validar importação sem erros, schema/constraints/políticas/grants, contagens por tabela no mesmo instante do export e acesso à aplicação isolada. Testar login com conta de teste autorizada; os hashes preservam senhas, mas providers/configurações exigem ajuste. Guardar resultados e erros.
6. Baixar arquivos necessários separadamente em More → Storage; nem snapshots nem export contêm esses arquivos. Código de Edge Functions e secrets também ficam fora do export.

**Limitação:** esse ensaio valida a recuperação do export atual, não a integridade do snapshot das 04:49:58. Ainda depende da execução do export pelo usuário e do destino isolado disponibilizado. Não executado nesta fase.

## Reversão operacional preferencial do pacote
Não restaurar banco completo para desfazer apenas funções. Os quatro corpos originais estão em `original-functions.sql`; snapshot com ACLs em `installed-definitions.snapshot.txt`. Conferir hashes imediatamente antes da implantação e guardar originais, proprietários, ACLs e trigger atualizado.

Desligar configuração do piloto no servidor, interromper endpoints/drenar chamadas iniciadas, revogar execução das duas novas RPCs se necessário e restaurar os quatro corpos/ACLs via migração aprovada. Não apagar confirmações, evidências ou histórico. Essa reversão reverte código, não desfaz dados já gravados; também restaura as limitações originais das RPCs Telegram.

## Restauração completa: último recurso, autorização separada
Antes de restaurar, exportar o estado atual. O usuário escolhe Restore to this backup na página de Backups e confirma. A restauração é permanente: perde alterações posteriores ao snapshot e reverte schema; indisponibilidade por alguns minutos. O código pode deixar de corresponder ao schema restaurado; testar o app e corrigir incompatibilidades por migração nova. Storage não é restaurado. Não descrever como reversível ou de baixo risco.