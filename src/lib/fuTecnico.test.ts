import { describe, test, expect } from 'bun:test';
import { etapaElegivel, prazoTecnico, linkTecnico, telefoneTecnico, registroTecnicoValido } from './fuTecnico';
describe('FU técnico — regras da Fase 1', () => {
  test('M+7 ocorre sete dias corridos após o fechamento', () => {
    expect(prazoTecnico('2026-11-02', 'M+7')).toBe('2026-11-09');
    expect(etapaElegivel('2026-11-02', '2026-11-08', 'M+7', true, true)).toBe(false);
    expect(etapaElegivel('2026-11-02', '2026-11-09', 'M+7', true, true)).toBe(true);
  });
  test('M+21 ocorre 21 dias corridos após o fechamento', () => {
    expect(prazoTecnico('2026-11-02', 'M+21')).toBe('2026-11-23');
    expect(etapaElegivel('2026-11-02', '2026-11-22', 'M+21', true, true)).toBe(false);
    expect(etapaElegivel('2026-11-02', '2026-11-23', 'M+21', true, true)).toBe(true);
  });
  test('inativo não é elegível', () => expect(etapaElegivel('2026-11-02', '2026-11-30', 'M+7', false, true)).toBe(false));
  test('não matriculado não é elegível', () => expect(etapaElegivel('2026-11-02', '2026-11-30', 'M+7', true, false)).toBe(false));
  test('telefone brasileiro recebe DDI e remove formatação', () => expect(telefoneTecnico('(81) 99999-1234')).toBe('5581999991234'));
  test('telefone inválido não produz link', () => expect(linkTecnico('123', 'Oi')).toBe(null));
  test('link preserva o número e o texto editado sem executar envio', () => {
    const link = new URL(linkTecnico('81999991234', 'Oi, Lívia!\nComo está?') ?? '');
    expect(link.host).toBe('wa.me');
    expect(link.pathname).toBe('/5581999991234');
    expect(link.searchParams.get('text')).toBe('Oi, Lívia!\nComo está?');
  });
  test('conclusão presencial exige registro efetivo e não precisa de WhatsApp', () => {
    expect(registroTecnicoValido('concluido', {})).toBe(false);
    expect(registroTecnicoValido('concluido', { data: '2026-11-09', coordenador: 'ANA', canal: 'presencial', observacoes: 'ORIENTAÇÃO PRESENCIAL' })).toBe(true);
  });
});