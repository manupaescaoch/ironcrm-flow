export function contextoImportacaoValido(revisado: { competencia: string; unidade: string }, atual: { competencia: string; unidade: string }): boolean {
  return revisado.competencia === atual.competencia && revisado.unidade === atual.unidade;
}
export function podeLimparTentativa(estado: string, vinculos: number): boolean {
  return vinculos === 0 && (estado === 'pendente' || estado === 'recusada');
}