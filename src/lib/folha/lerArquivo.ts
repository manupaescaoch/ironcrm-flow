// Leitura no navegador, com bibliotecas empacotadas no próprio app (nenhum serviço externo).
import * as XLSX from "xlsx";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { lerPagina, lerPlanilha, type ItemLido } from "./contracheque";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type Extracao = "texto_pdf" | "planilha" | "manual_ocr_pendente";
export interface Leitura { formato: "pdf" | "xlsx" | "xls" | "csv"; extracao: Extracao; ref: string | null; itens: ItemLido[]; aviso?: string }

export async function lerArquivo(file: File): Promise<Leitura> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const buf = await file.arrayBuffer();
  if (ext === "pdf") {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const itens: ItemLido[] = []; let ref: string | null = null; let comTexto = 0;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      // Reagrupa por linha (posição vertical).
      const porY = new Map<number, string[]>();
      for (const it of tc.items as any[]) { const y = Math.round(it.transform[5]); (porY.get(y) || porY.set(y, []).get(y)!).push(it.str); }
      const texto = [...porY.entries()].sort((a, b) => b[0] - a[0]).map(([, s]) => s.join(" ")).join("\n");
      if (texto.replace(/\s/g, "").length > 20) comTexto++;
      const l = lerPagina(texto, p);
      ref = ref || l.ref;
      itens.push({ pagina: p, nome: l.nome, funcao: l.funcao, bruto: l.bruto, liquido: l.liquido });
    }
    if (!comTexto) return { formato: "pdf", extracao: "manual_ocr_pendente", ref: null, itens: itens.map((i) => ({ ...i, nome: "", funcao: "", bruto: null, liquido: null })),
      aviso: "PDF sem texto (escaneado). A leitura automática por OCR está desativada nesta versão: preencha os campos manualmente conferindo o arquivo." };
    return { formato: "pdf", extracao: "texto_pdf", ref, itens };
  }
  if (ext === "xlsx" || ext === "xls" || ext === "csv") {
    // CSV: texto puro (sem conversão automática de "2027-02" em data); planilhas: datas reais.
    const wb = XLSX.read(buf, { type: "array", raw: ext === "csv", cellDates: true });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
    const r = lerPlanilha(rows);
    if (r.erro) throw new Error(r.erro);
    return { formato: ext, extracao: "planilha", ref: r.ref, itens: r.itens };
  }
  throw new Error("Formato não suportado. Use PDF, XLSX, XLS ou CSV.");
}

export async function sha256(file: File) {
  const h = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
