import * as XLSX from "xlsx";
import { CABECALHOS_CLARA } from "../../../supabase/functions/_shared/folhaClara";
export { CABECALHOS_CLARA };
export function gerarLoteClara(linhas: { pix: string; cpf: string; valor: number; descricao: string }[]) {
  const ws = XLSX.utils.aoa_to_sheet([CABECALHOS_CLARA, ...linhas.map(l => [String(l.pix), String(l.cpf), l.valor, l.descricao])]);
  for (let r = 2; r <= linhas.length + 1; r++) {
    for (const c of ["A", "B"]) { ws[`${c}${r}`].t = "s"; ws[`${c}${r}`].z = "@"; }
    ws[`C${r}`].t = "n"; ws[`C${r}`].z = "0.00";
  }
  ws["!cols"] = [{ wch: 71.38 }, { wch: 31.25 }, { wch: 9.63 }, { wch: 108.38 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}