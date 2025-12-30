/**
 * Traduz mensagens de erro do Supabase para português amigável
 */
export function getErrorMessage(error: unknown): string {
  const message = 
    (error as any)?.message || 
    (error as any)?.error_description ||
    (error as Error)?.toString() || 
    '';

  // Erros de permissão do trigger (já estão em português)
  if (message.includes('Operação não permitida')) {
    return message;
  }

  // Erros de duplicação de telefone
  if (message.includes('duplicate') && message.includes('telefone')) {
    return 'Já existe um lead cadastrado com este telefone';
  }

  // Erros de duplicação genéricos
  if (message.includes('duplicate key') || message.includes('unique_violation') || message.includes('already exists')) {
    return 'Este registro já existe no sistema';
  }

  // Erros de RLS (Row Level Security)
  if (message.includes('violates row-level security') || message.includes('new row violates')) {
    return 'Você não tem permissão para realizar esta ação';
  }

  // Erros de validação de status
  if (message.includes('Invalid status_funil') || message.includes('status não autorizada')) {
    return 'Status do funil inválido ou não autorizado';
  }

  // Erros de chave estrangeira
  if (message.includes('foreign key') || message.includes('violates foreign key')) {
    return 'Registro referenciado não existe ou foi removido';
  }

  // Erros de conexão
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('network')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente';
  }

  // Erros de autenticação
  if (message.includes('JWT') || message.includes('token') || message.includes('auth')) {
    return 'Sessão expirada. Faça login novamente';
  }

  // Erros de campos obrigatórios
  if (message.includes('null value') || message.includes('not-null constraint')) {
    return 'Campo obrigatório não preenchido';
  }

  // Se a mensagem original for curta e legível, retorna ela
  if (message.length > 0 && message.length < 200 && !message.includes('PGRST')) {
    return message;
  }

  // Erro genérico
  return 'Erro ao processar a solicitação. Tente novamente.';
}
