/**
 * Gera uma mensagem natural e variada para encerramento de turno.
 * @param responsibleName Nome do responsável (o primeiro nome será usado na saudação)
 * @param formLink Link original do formulário (mantido sem alterações)
 */
export function generateShiftClosingMessage(responsibleName: string, formLink: string): string {
  const firstName = responsibleName.split(' ')[0];

  const initialQuestions = [
    `${firstName}, finalizou o turno?`,
    `${firstName}, já encerrou o turno?`,
    `${firstName}, turno finalizado?`,
    `${firstName}, terminou o horário?`,
    `${firstName}, fechou o turno por aí?`,
    `${firstName}, tudo certo com o fim do turno?`,
    `${firstName}, já finalizou as atividades de hoje?`,
  ];

  const messageBodies = [
    "Preenche o formulário agora com tudo que aconteceu. Não deixa pra depois pra não passar nada batido. 👊",
    "Registra agora no formulário os principais pontos do dia. Fazendo na hora, fica tudo mais fácil e nada se perde.",
    "Já faz o encerramento agora com ocorrências, pendências e observações importantes. Melhor registrar enquanto está tudo fresco.",
    "Antes de sair do ritmo, preenche o formulário com tudo que aconteceu no turno. Isso evita informação perdida depois. ✅",
    "Já deixa o formulário preenchido com o resumo do que aconteceu. Coisa simples, mas evita muita dor de cabeça depois.",
    "Aproveita que os detalhes estão frescos na memória e preenche o encerramento agora. Ajuda muito a gente!",
    "Dá uma passada rápida no formulário de encerramento pra registrar o que rolou hoje. É rapidinho e evita esquecimentos. 📝",
  ];

  const randomQuestion = initialQuestions[Math.floor(Math.random() * initialQuestions.length)];
  const randomBody = messageBodies[Math.floor(Math.random() * messageBodies.length)];

  return `${randomQuestion}\n\n${randomBody}\n\n${formLink}`;
}

