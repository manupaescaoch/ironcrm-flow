import { describe, expect, it } from 'bun:test';
import { contextoImportacaoValido, podeLimparTentativa } from './folhaImportacaoRegras';
describe('prévia vinculada à competência/unidade', () => {
  const revisado = { competencia: '2027-04', unidade: 'madalena' };
  it('recusa outro mês mesmo sem referência detectada', () => expect(contextoImportacaoValido(revisado, { competencia: '2027-05', unidade: 'madalena' })).toBe(false));
  it('recusa outra unidade', () => expect(contextoImportacaoValido(revisado, { competencia: '2027-04', unidade: 'setubal' })).toBe(false));
  it('aceita o contexto revisado', () => expect(contextoImportacaoValido(revisado, revisado)).toBe(true));
});
describe('limpeza de temporários', () => {
  it('permite tentativa recusada sem vínculo', () => expect(podeLimparTentativa('recusada', 0)).toBe(true));
  it('preserva documento válido ou histórico', () => expect(podeLimparTentativa('recusada', 1)).toBe(false));
  it('não interrompe gravação concorrente', () => expect(podeLimparTentativa('processando', 0)).toBe(false));
  it('preserva tentativa concluída', () => expect(podeLimparTentativa('concluida', 0)).toBe(false));
});