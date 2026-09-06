export const UNIDADES_FORMULARIO = [
  { value: 'MADALENA', label: 'Madalena', id: 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6' },
  { value: 'BOA VIAGEM', label: 'Boa Viagem', id: 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a' },
  { value: 'SETUBAL', label: 'Setúbal', id: '00000000-0000-0000-0000-000000000000' },
] as const;

export type UnidadeFormularioValue = typeof UNIDADES_FORMULARIO[number]['value'];

export function getUnidadeIdByValue(value: string): string | undefined {
  return UNIDADES_FORMULARIO.find((u) => u.value === value)?.id;
}

export function getUnidadeLabelByValue(value: string): string {
  return UNIDADES_FORMULARIO.find((u) => u.value === value)?.label ?? value;
}
