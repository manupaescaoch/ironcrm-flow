// Leitura local de contracheques (sem serviço externo).
// Regras de texto portadas de meuappfelizevo.zip — public/evo.html (parseSlipHeader, parseSlipTotals, slipMonth).
// Diferença: o ZIP usa OCR (Tesseract via CDN). Aqui só lemos o texto embutido no PDF; PDF escaneado fica para preenchimento manual.

export interface ItemLido { pagina: number | null; nome: string; funcao: string; bruto: number | null; liquido: number | null }

const norm = (s: string) => String(s || "").replace(/[ \t\u00a0]+/g, " ").trim();
export const moneyBR = (s: string) => {
  const x = String(s || "").replace(/R\$/gi, "").replace(/\s/g, "");
  if (!x) return NaN;
  const n = Number(x.includes(",") ? x.replace(/\./g, "").replace(",", ".") : x);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const valores = (s: string) => [...String(s || "").matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}/g)].map((m) => moneyBR(m[0])).filter((v) => v >= 0);
const limpaNome = (s: string) => norm(s).replace(/^0{2,}\d+\s*/, "").replace(/\s+Fun[cç][aã]o.*$/i, "").trim();
const limpaFuncao = (s: string) => norm(s).replace(/^.*?Fun[cç][aã]o\s*[:-]?\s*/i, "").replace(/\s+(?:CPF|CTPS|CBO|Adm\.?|Admiss[aã]o).*$/i, "").trim();
const EMPRESA = /IRON|LIFTING|CLUB|LTDA/i;

/** Mês de referência: primeira data dd/mm/aaaa do texto (regra do ZIP) ou "Referência: mm/aaaa". */
export function mesReferencia(texto: string): string | null {
  const t = norm(texto);
  const r = t.match(/Refer[eê]ncia\s*[:-]?\s*(\d{1,2})[/.-](20\d{2})/i);
  if (r) return `${r[2]}-${String(+r[1]).padStart(2, "0")}`;
  const d = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})/);
  if (!d) return null;
  const m = +d[2];
  return m >= 1 && m <= 12 ? `${d[3]}-${String(m).padStart(2, "0")}` : null;
}

export function lerPagina(texto: string, pagina: number | null): ItemLido & { ref: string | null } {
  const linhas = String(texto || "").split(/\n+/).map(norm).filter(Boolean), all = linhas.join("\n");
  let nome = "", funcao = "";
  let m = all.match(/0{2,}\d+\s+([^\n]{4,80}?)\s+Fun[cç][aã]o\s*[:-]?\s*([^\n]{2,60})/i);
  if (m) { nome = limpaNome(m[1]); funcao = limpaFuncao("Função: " + m[2]); }
  if (!funcao) { m = all.match(/Fun[cç][aã]o\s*[:-]?\s*([^\n]{2,60})/i); if (m) funcao = limpaFuncao("Função: " + m[1]); }
  if (!nome) for (const z of linhas) { const mm = z.match(/^\s*0{2,}\d+\s+(.+?)(?:\s+Fun[cç][aã]o|$)/i); if (mm && !EMPRESA.test(mm[1])) { nome = limpaNome(mm[1]); break; } }
  if (!nome) { const ci = linhas.findIndex((z) => /\bCPF\b/i.test(z)); for (let j = ci - 1; j >= 0 && j >= ci - 3; j--) { const z = limpaNome(linhas[j] || ""); if (/[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]{2,}/.test(z) && !EMPRESA.test(z)) { nome = z; break; } } }
  let bruto: number | null = null, liquido: number | null = null, vi = -1;
  for (let i = 0; i < linhas.length; i++) if (/Valor\s*L[ií1I]quido/i.test(linhas[i])) { vi = i; const v = valores(linhas[i]); if (v.length) liquido = v[v.length - 1]; break; }
  if (vi >= 0 && liquido == null) for (let j = vi + 1; j <= Math.min(linhas.length - 1, vi + 2); j++) { const v = valores(linhas[j]); if (v.length) { liquido = v[v.length - 1]; break; } }
  const tb = all.match(/Total\s+(?:de\s+)?(?:Vencimentos|Proventos)[^\d]{0,40}(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (tb) bruto = moneyBR(tb[1]);
  else if (vi > 0) for (let j = vi - 1; j >= Math.max(0, vi - 4); j--) { const v = valores(linhas[j]).filter((x) => x > 0 && (liquido == null || x >= liquido)); if (v.length) { bruto = v[0]; break; } }
  return { pagina, nome: nome.toUpperCase(), funcao: funcao.toUpperCase(), bruto, liquido, ref: mesReferencia(all) };
}

/** Planilha: cabeçalhos aceitos — NOME, FUNÇÃO/CARGO, BRUTO/VALOR BRUTO, LÍQUIDO/VALOR LÍQUIDO, COMPETÊNCIA/REFERÊNCIA (opcional). */
export function lerPlanilha(linhas: Record<string, unknown>[]): { itens: ItemLido[]; ref: string | null; erro?: string } {
  if (!linhas.length) return { itens: [], ref: null, erro: "Planilha vazia" };
  const chave = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
  const cols = Object.keys(linhas[0]);
  const achar = (...nomes: string[]) => cols.find((c) => nomes.includes(chave(c)));
  const cN = achar("NOME", "COLABORADOR", "FUNCIONARIO"), cF = achar("FUNCAO", "CARGO"), cB = achar("BRUTO", "VALORBRUTO", "SALARIOBRUTO"), cL = achar("LIQUIDO", "VALORLIQUIDO", "SALARIOLIQUIDO"), cR = achar("COMPETENCIA", "REFERENCIA", "MES");
  if (!cN || !cL) return { itens: [], ref: null, erro: "A planilha precisa das colunas NOME e LÍQUIDO" };
  const num = (v: unknown) => (typeof v === "number" ? Math.round(v * 100) / 100 : moneyBR(String(v ?? "")));
  const refs = new Set<string>();
  const itens = linhas.filter((r) => String(r[cN] ?? "").trim()).map((r, i) => {
    if (cR && r[cR] instanceof Date) { const d = r[cR] as Date; refs.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
    else if (cR) { const v = String(r[cR] ?? "").trim(); const m = v.match(/^(20\d{2})-(\d{2})$/) || v.match(/^(\d{1,2})[/.-](20\d{2})$/); if (m) refs.add(m[1].length === 4 ? `${m[1]}-${m[2]}` : `${m[2]}-${String(+m[1]).padStart(2, "0")}`); }
    const b = cB ? num(r[cB]) : NaN, l = num(r[cL]);
    return { pagina: i + 2, nome: String(r[cN]).trim().toUpperCase(), funcao: cF ? String(r[cF] ?? "").trim().toUpperCase() : "", bruto: Number.isFinite(b) ? b : null, liquido: Number.isFinite(l) ? l : null };
  });
  if (refs.size > 1) return { itens, ref: null, erro: "A planilha mistura competências diferentes" };
  return { itens, ref: refs.size ? [...refs][0] : null };
}

const chaveNome = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().toUpperCase();
/** Sugestão de associação por nome exato normalizado; nunca adivinha por semelhança. */
export function sugerirColaborador<C extends { id: string; nome: string; tipo: string }>(nome: string, colabs: C[]): string | null {
  const k = chaveNome(nome); if (!k) return null;
  const achados = colabs.filter((c) => c.tipo === "CLT" && chaveNome(c.nome) === k);
  return achados.length === 1 ? achados[0].id : null;
}

export interface ItemRevisado { colaborador_id: string; liquido: number | null; bruto: number | null }
/** Validação antes de enviar: competência, associação e duplicidade dentro do arquivo. */
export function validarImportacao(itens: ItemRevisado[], competencia: string, ref: string | null, competenciaConfirmada: boolean): string | null {
  if (!itens.length) return "Nenhum item para importar";
  if (ref && ref !== competencia) return `O contracheque é de ${ref}, mas a folha está em ${competencia}`;
  if (!ref && !competenciaConfirmada) return "Competência não identificada no arquivo: confirme manualmente";
  const vistos = new Set<string>();
  for (const it of itens) {
    if (!it.colaborador_id) return "Associe todos os itens a um colaborador";
    if (vistos.has(it.colaborador_id)) return "O mesmo colaborador aparece mais de uma vez";
    vistos.add(it.colaborador_id);
    if (it.liquido == null || !Number.isFinite(it.liquido) || it.liquido < 0) return "Informe o valor líquido de todos os itens (zero é aceito)";
  }
  return null;
}
