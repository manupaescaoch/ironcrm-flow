import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { chamarFolha } from "./FolhaExtras";
import { gerarLoteClara } from "@/lib/folha/clara";
import { linhaClara, normalizarPix, totalClara, type FonteClara, type EscolhaClara, type TipoPix } from "../../../supabase/functions/_shared/folhaClara";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function LoteClara({ comp, unidadeId, unidadeNome, onFeito, parcela }: { comp: string; unidadeId: string; unidadeNome: string; onFeito: () => Promise<void>; parcela?: 1 | 2 }) {
  const [aberto, setAberto] = useState(false), [busy, setBusy] = useState(false), [erro, setErro] = useState("");
  const [fontes, setFontes] = useState<FonteClara[]>([]), [escolhas, setEscolhas] = useState<Record<string, EscolhaClara>>({});
  const [selecionados, setSelecionados] = useState<string[]>([]), [anteriores, setAnteriores] = useState<string[]>([]), [reexportar, setReexportar] = useState(false), [excluidos, setExcluidos] = useState({ confirmados: 0, zero: 0 });
  useEffect(() => { setAberto(false); setFontes([]); setSelecionados([]); setExcluidos({ confirmados: 0, zero: 0 }); }, [comp, unidadeId]);
  const selecionadas = fontes.filter(f => selecionados.includes(f.pagamento_id));
  const pendencias = selecionadas.flatMap(f => { try { linhaClara(f, escolhas[f.pagamento_id] || { pagamento_id: f.pagamento_id }, ""); return []; } catch (e) { return [(e as Error).message]; } });
  const destino = (f: FonteClara) => {
    const escolha = escolhas[f.pagamento_id];
    const chave = normalizarPix(f.pix, escolha?.tipo);
    if (chave) return chave.replace(/[().\s/-]/g, "").toLowerCase();
    if (escolha?.fornecedor_cadastrado && f.cpf) return f.cpf.replace(/\D/g, "");
    return f.pix?.trim().toLowerCase() || "";
  };
  const repetidos = fontes.filter(f => destino(f) && fontes.some(o => o.pagamento_id !== f.pagamento_id && destino(o) === destino(f)));
  const jaExportados = selecionados.filter(id => anteriores.includes(id));
  async function abrir() {
    setAberto(true); setBusy(true); setErro(""); setReexportar(false); setEscolhas({}); setSelecionados([]); setFontes([]); setExcluidos({ confirmados: 0, zero: 0 });
    try { const r = await chamarFolha({ acao: parcela ? "previa_ajuda_clara" : "previa_clara", parcela, unidade_id: unidadeId, competencia: comp }); setFontes(r.fontes); setAnteriores(r.anteriores); setExcluidos({ confirmados: r.excluidos_confirmados || 0, zero: r.excluidos_zero || 0 }); } catch (e) { setErro((e as Error).message); } finally { setBusy(false); }
  }
  async function baixar() {
    setBusy(true); setErro("");
    try {
      const r = await chamarFolha({ acao: parcela ? "exportar_ajuda_clara" : "exportar_clara", parcela, unidade_id: unidadeId, competencia: comp, escolhas: selecionados.map(id => escolhas[id] || { pagamento_id: id }), reexportar });
      if (r.reexportacao_necessaria) { setAnteriores(r.anteriores); setReexportar(false); return; }
      const url = URL.createObjectURL(new Blob([gerarLoteClara(r.linhas)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = `lote-clara-${parcela ? `ajuda-parcela-${parcela}-` : ""}${unidadeNome}-${comp}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAnteriores(prev => [...new Set([...prev, ...selecionados])]); setReexportar(false); await onFeito();
    } catch (e) { setErro((e as Error).message); } finally { setBusy(false); }
  }
  return <><Button variant="outline" onClick={abrir}><Download className="w-4 h-4 mr-2" />{parcela ? `Clara ajuda · parcela ${parcela}` : "Exportar lote Clara"}</Button>
    <Dialog open={aberto} onOpenChange={setAberto}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Lote Clara {parcela ? `· Ajuda parcela ${parcela}` : "salarial"} · {unidadeNome} · {comp}</DialogTitle></DialogHeader>
      <p className="text-sm">{selecionados.length} destinatários · Total {brl(totalClara(selecionadas))}</p>
      <p className="text-sm text-muted-foreground">Conta pagadora: {unidadeNome}. Exportação não confirma pagamento e não executa PIX.</p>
      {!busy && !fontes.length && !erro && <p>Nenhum pagamento pendente com valor positivo.</p>}
      {(excluidos.confirmados + excluidos.zero) > 0 && <p className="text-sm text-muted-foreground">Fora da seleção: {excluidos.confirmados} já confirmado(s) · {excluidos.zero} com valor zero.</p>}
      {!!selecionadas.length && <ul className="text-sm list-disc pl-5">{selecionadas.map(f => <li key={f.pagamento_id}>{f.nome} · {brl(f.valor)}</li>)}</ul>}
      {fontes.map(f => <div key={f.pagamento_id} className="border-b py-3 space-y-2">
        <label className="flex gap-2 items-center"><Checkbox aria-label={`Selecionar ${f.nome}`} checked={selecionados.includes(f.pagamento_id)} disabled={busy} onCheckedChange={v => { setSelecionados(s => v ? [...s, f.pagamento_id] : s.filter(id => id !== f.pagamento_id)); setReexportar(false); }} /><span className="font-medium break-words">{f.nome} · {brl(f.valor)}</span></label>
        <p className="text-xs text-muted-foreground break-all">PIX: {f.pix || "Ausente"} · Vínculo {f.colaborador_id.slice(0, 8)}{anteriores.includes(f.pagamento_id) ? " · Já exportado" : ""}</p>
        {parcela && <p className="text-xs text-muted-foreground">Data informada: {(f as FonteClara & { data_prevista?: string }).data_prevista || "Não informada — exportação bloqueada"}</p>}
        <Select disabled={busy} value={escolhas[f.pagamento_id]?.tipo || ""} onValueChange={v => setEscolhas(e => ({ ...e, [f.pagamento_id]: { ...e[f.pagamento_id], pagamento_id: f.pagamento_id, tipo: v as TipoPix } }))}><SelectTrigger aria-label={`Tipo PIX de ${f.nome}`}><SelectValue placeholder="Confirmar tipo da chave PIX" /></SelectTrigger><SelectContent>{[["cpf", "CPF"], ["cnpj", "CNPJ"], ["telefone", "Telefone"], ["email", "E-mail"], ["aleatoria", "Chave aleatória"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        {f.cpf && <label className="flex gap-2 text-sm items-center"><Checkbox disabled={busy} checked={escolhas[f.pagamento_id]?.fornecedor_cadastrado === true} onCheckedChange={v => setEscolhas(e => ({ ...e, [f.pagamento_id]: { ...e[f.pagamento_id], pagamento_id: f.pagamento_id, fornecedor_cadastrado: v === true } }))} />Confirmo fornecedor já cadastrado na Clara · CPF/CNPJ {f.cpf}</label>}
      </div>)}
      {!!repetidos.length && <p role="alert" className="text-sm text-destructive">Possíveis destinatários repetidos: {repetidos.map(f => f.nome).join(", ")}. Obrigações mantidas separadas para conferência.</p>}
      {pendencias.map(p => <p key={p} className="text-sm text-destructive">{p}</p>)}
      {!!jaExportados.length && <label className="flex gap-2 text-sm items-center"><Checkbox aria-label="Confirmar reexportação" disabled={busy} checked={reexportar} onCheckedChange={v => setReexportar(v === true)} />Confirmo reexportar {jaExportados.length} pagamentos já exportados</label>}
      {erro && <p role="alert" className="text-destructive text-sm">{erro}</p>}
      <Button onClick={baixar} disabled={busy || !selecionados.length || !!pendencias.length || (!!jaExportados.length && !reexportar)}><Download className="w-4 h-4 mr-2" />{busy ? "Aguarde…" : "Baixar XLSX Clara"}</Button>
    </DialogContent></Dialog></>;
}