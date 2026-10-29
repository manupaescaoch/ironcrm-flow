/** Presentation gate only; server RPCs remain the authority for unit/action access. */
export function perfilFolhaPermitido(role: string | null | undefined): boolean {
  return role === "admin" || role === "gerente";
}