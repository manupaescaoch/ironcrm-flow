// Analytical presentation only: never persist the transformed label or log raw notes.
const safeLossLabels = [
 'Preço alto', 'Localização inconveniente', 'Falta de tempo', 'Preferiu outro lugar',
 'Desistiu / Sem interesse', 'Não conseguimos contato', 'Vai pensar (follow-up)',
 'Mudou de cidade', 'Outro', 'Preço', 'Não gostou do treino', 'Só estava testando',
 'Não tem interesse', 'Optou por outra academia', 'Problemas financeiros',
 'Problemas de saúde', 'Sem tempo disponível', 'Não atende / Telefone inválido',
 'NÃO INFORMADO',
];
export function safeLossReason(value:unknown):string {
 if(typeof value!=='string'||!value.trim())return 'NÃO INFORMADO';
 const label=value.trim();
 // Only a closed catalog can guarantee that arbitrary historical text is not disclosed.
 const known=safeLossLabels.find(item=>item.toLocaleLowerCase('pt-BR')===label.toLocaleLowerCase('pt-BR'));
 if(known)return label;
 const category=safeLossLabels.find(item=>label.toLocaleLowerCase('pt-BR').startsWith(`${item.toLocaleLowerCase('pt-BR')}:`));
 return category??'Outro';
}
export function safeLossGroups(rows:Record<string,unknown>[]) {
 const counts=new Map<string,number>();
 for(const row of rows){const label=safeLossReason(row.motivo_perda);counts.set(label,(counts.get(label)??0)+1);}
 return [...counts].sort(([a],[b])=>a.localeCompare(b)).map(([motivo,qtd])=>({motivo,qtd}));
}
export function countRecordedClosings(rows:{lead_id:string|null}[]) {
 return new Set(rows.flatMap(row=>row.lead_id?[row.lead_id]:[])).size;
}
// Verified: migration 0045 SHA-256 matches drizzle.__drizzle_migrations id 46;
// created_at=1793622227046, the technical migration marker (not immutable execution evidence).
export const coverage={
 criterio:'convertido_em_aluno_at',historico_completo:false,
 inicio_registro_automatico:'2026-11-02T09:23:47.046-03:00',
 observacao:'Registros anteriores à implantação podem não possuir data de conversão. O início informado é o marcador técnico da migração, não uma trilha imutável de execução.',
};
export const indicatorDefinitions={
 leads_cadastrados:'Quantidade de registros de leads criados no período em America/Recife, sem deduplicação por telefone.',
 experimentais:'Telefones normalizados não vazios distintos com data atual de experimental dentro do período; não representa eventos históricos nem presença comprovada.',
 por_status:'Classificação exclusiva por telefone: convertido > aula_realizada > perdido > aula_agendada/outros. Empate mantém o primeiro registro por id crescente. Baseada no status atual, não na presença das interações.',
 pendentes_atualizacao:'Telefones vencedores cujo status é exatamente aula_agendada e cuja data atual de experimental é anterior ao dia atual em America/Recife. Outros status classificados no grupo aula_agendada não são incluídos.',
 matriculas_por_data_conversao:'Registros de leads com convertido_em_aluno_at no período, sem deduplicação, sem exigir status atual convertido e sem cobertura retroativa.',
 fechamentos_registrados_no_periodo:'Leads distintos com interação marcada fechou_matricula=true e data_fechamento no período (fim exclusivo). Conta o fechamento registrado, não a matrícula atualmente ativa; não somar às conversões por carimbo.',
 por_unidade:'Contagens atribuídas à unidade do registro vencedor após deduplicação global por telefone; unidades sem resultados são omitidas.',
 por_origem:'Cadastros criados no período agrupados pela origem literal atual, preservando variações históricas e sem deduplicação por telefone.',
 perdas_por_motivo:'Registros com data_perda no período agrupados por categoria segura do motivo atual, sem exigir status atual perdido. Observações livres não são retornadas; rótulos não reconhecidos são apresentados como Outro.',
};
export const unitCriterion={
 deduplicacao:'global_por_telefone',atribuicao:'unidade_do_registro_vencedor',
 observacao:'O resultado por unidade representa a atribuição global atual, não necessariamente todas as oportunidades comerciais locais.',
};