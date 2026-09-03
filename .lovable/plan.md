# Visibilidade por setor no EVO OPS

## Situação atual (verificada)

No banco, a visibilidade das atividades é **por unidade**: qualquer usuário vinculado à unidade — inclusive recepção e comercial — pode ver todas as atividades daquela unidade. O botão "Minhas / Toda a unidade" no app é apenas um filtro de tela, não uma restrição real de acesso.

## O que muda

Recepção e comercial passam a ver **as próprias atividades + as do seu setor**, na mesma unidade. Admin, gerente e coordenador continuam vendo tudo da unidade (admin vê todas as unidades).

Execução continua liberada: qualquer pessoa da unidade pode iniciar/concluir uma tarefa visível para ela, e o sistema registra quem executou.

### Como o setor é identificado

O vínculo já existe: cada pessoa está em `cronograma_funcionarios` com `setor` e `user_id`. A regra passa a comparar o setor da pessoa logada com o setor da atividade.

Casos de borda:
- Pessoa sem `user_id` vinculado: mantém o comportamento atual (vê a unidade), para não travar ninguém antes do vínculo estar completo.
- Pessoa com setor definido e atividade **sem setor**: fica visível (evita tarefas órfãs invisíveis).
- Pessoa em mais de um setor/unidade: vê a união dos setores dela.

### Efeito nas telas

- **Meu Dia / Cronograma / Tarefas (mobile):** a opção "Toda a unidade" passa a mostrar "Meu setor" para recepção/comercial — só o que a regra permite.
- **Gestão do dia (CRM):** sem mudança para admin/gerente/coordenador; recepção/comercial veem apenas seu escopo.
- **Alertas:** atrasadas/críticas seguem o mesmo escopo.

## Detalhes técnicos

1. Função `public.ops_setores_do_usuario(_user_id uuid)` (SECURITY DEFINER, STABLE) retornando os setores do usuário via `cronograma_funcionarios.user_id`.
2. Substituir a policy `select_cronograma_ativ_by_unidade` por versão que mantém unidade como base e adiciona o recorte de setor quando o usuário **não** é admin/gerente/coordenador e possui vínculo com setor.
3. Manter `insert_cronograma_ativ_by_unidade` e `update_cronograma_ativ_by_unidade` como estão (execução liberada na unidade).
4. Alinhar `ops_execucoes`, `ops_comentarios`, `ops_anexos` para leitura pelo mesmo critério (via `ops_can_access_atividade`).
5. Frontend: rótulo do toggle passa a "Meu setor" quando o papel é recepção/comercial (`useOpsMeuDia`, `OpsCronograma`, `OpsTarefas`); nenhuma lógica de negócio duplicada no cliente.
6. Nada é apagado ou renomeado: rotinas, WhatsApp, `send-cronograma-messages` e auditoria seguem intactos.
