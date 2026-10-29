// Exportação em PDF (formato do ZIP: arquivo único com resumo, ou um arquivo por colaborador).
// Os valores vêm SEMPRE do servidor (folha-operacoes → dados_exportacao); aqui só desenhamos.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface LinhaExport {
  colaborador: { id: string; nome: string; tipo: "CLT" | "ESTAGIARIO"; funcao: string | null; turno: string | null };
  resultado: { base: number; passagem: number; extras: number; comissao: number; desconto: number; total: number; bruto: number; contrachequeImportado: boolean; ajudaCusto?: { passagem: number; alimentacao: number; ajustes: number; total: number } };
}
export interface DadosExport { unidade: { nome: string }; competencia: string; fechada: boolean; versao_calculo: string; linhas: LinhaExport[]; total: number; gerado_em: string; documento: string }

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const AVISO_INTERNO = "DEMONSTRATIVO INTERNO GERADO PELO SISTEMA — NÃO É CONTRACHEQUE OFICIAL";

export function filtrar(linhas: LinhaExport[], filtro: string, escolhidos: Set<string>) {
  if (filtro === "ESTAGIARIO" || filtro === "CLT") return linhas.filter((l) => l.colaborador.tipo === filtro);
  if (filtro.startsWith("T:")) return linhas.filter((l) => (l.colaborador.turno || "").toUpperCase().includes(filtro.slice(2).toUpperCase()));
  if (filtro === "pick") return linhas.filter((l) => escolhidos.has(l.colaborador.id));
  return linhas;
}

function cab(d: jsPDF, dados: DadosExport, titulo: string) {
  d.setFont("helvetica", "bold"); d.setFontSize(14); d.text(titulo, 12, 16);
  d.setFont("helvetica", "normal"); d.setFontSize(9);
  d.text(`${dados.unidade?.nome || ""} · Competência ${dados.competencia} · ${dados.fechada ? "fechada (retrato histórico)" : "aberta (prévia, pode mudar)"}`, 12, 22);
  d.setFont("helvetica", "bold"); d.setTextColor(170, 30, 30); d.text(AVISO_INTERNO, 12, 28); d.setTextColor(0, 0, 0);
}

function ficha(d: jsPDF, dados: DadosExport, l: LinhaExport) {
  cab(d, dados, `Demonstrativo interno — ${l.colaborador.nome}`);
  const r = l.resultado;
  const body = r.contrachequeImportado
    ? [["Líquido do contracheque importado", brl(r.total)]]
    : [["Bolsa/Salário", brl(r.base)], ["Passagem", brl(r.passagem)], ["Adicionais", brl(r.extras)], ["Comissão", brl(r.comissao)], ["Descontos de saúde", "-" + brl(r.desconto)]];
  autoTable(d, { startY: 34, head: [["Item", "Valor"]], body, foot: [["TOTAL A RECEBER", brl(r.total)]], margin: { left: 12, right: 12 }, columnStyles: { 1: { halign: "right" } } });
  if (r.ajudaCusto && r.ajudaCusto.total > 0) autoTable(d, { startY: (d as any).lastAutoTable.finalY + 10, head: [["Ajuda de custo separada — NÃO incluída no líquido", "Valor"]], body: [["Passagem", brl(r.ajudaCusto.passagem)], ["Alimentação", brl(r.ajudaCusto.alimentacao)], ["Ajustes identificados", brl(r.ajudaCusto.ajustes)]], foot: [["AJUDA SEPARADA — DUAS PARCELAS", brl(r.ajudaCusto.total)]], margin: { left: 12, right: 12 } });
}

function resumo(d: jsPDF, dados: DadosExport, L: LinhaExport[]) {
  cab(d, dados, "Resumo geral da folha");
  const body = L.map((l) => { const r = l.resultado, s = r.contrachequeImportado; return [l.colaborador.nome, l.colaborador.tipo === "CLT" ? `CLT${l.colaborador.funcao ? " · " + l.colaborador.funcao : ""}` : "Estagiário", s ? "—" : brl(r.base), s ? "—" : brl(r.passagem), s ? "—" : brl(r.extras + r.comissao), brl(r.total)]; });
  const total = L.reduce((a, l) => a + l.resultado.total, 0);
  autoTable(d, { startY: 34, head: [["Colaborador", "Tipo", "Bolsa/Salário", "Passagem", "Adicionais", "Total"]], body, foot: [["TOTAL GERAL", "", "", "", "", brl(total)]], margin: { left: 12, right: 12 }, styles: { fontSize: 9 } });
}

function rodape(d: jsPDF, dados: DadosExport) {
  const n = d.getNumberOfPages();
  for (let i = 1; i <= n; i++) { d.setPage(i); d.setFontSize(7); d.setTextColor(120, 120, 120); d.text(`Gerado em ${new Date(dados.gerado_em).toLocaleString("pt-BR")} · cálculo ${dados.versao_calculo} · ${AVISO_INTERNO}`, 12, 290); d.text(`Página ${i} de ${n}`, 198, 290, { align: "right" }); }
}

export function gerarPdfs(dados: DadosExport, L: LinhaExport[], separados: boolean): { nome: string; blob: Blob }[] {
  const ord = [...L].sort((a, b) => a.colaborador.nome.localeCompare(b.colaborador.nome));
  const slug = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (separados) return ord.map((l) => { const d = new jsPDF({ unit: "mm", format: "a4" }); ficha(d, dados, l); rodape(d, dados); return { nome: `demonstrativo-interno-${slug(l.colaborador.nome)}-${dados.competencia}.pdf`, blob: d.output("blob") }; });
  const d = new jsPDF({ unit: "mm", format: "a4" });
  ord.forEach((l, i) => { if (i) d.addPage(); ficha(d, dados, l); });
  if (ord.length > 1) { d.addPage(); resumo(d, dados, ord); }
  rodape(d, dados);
  return [{ nome: `folha-demonstrativo-interno-${slug(dados.unidade?.nome || "unidade")}-${dados.competencia}.pdf`, blob: d.output("blob") }];
}
