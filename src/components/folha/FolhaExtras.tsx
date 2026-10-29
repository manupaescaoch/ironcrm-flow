import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { sugerirColaborador, validarImportacao, moneyBR } from "@/lib/folha/contracheque";
import { lerArquivo, type Leitura } from "@/lib/folha/lerArquivo";
import { filtrar, gerarPdfs, AVISO_INTERNO, type DadosExport } from "@/lib/folha/exportar";

import { RelacaoPagamentos } from "./RelacaoPagamentos";
import { contextoImportacaoValido } from "../../../supabase/functions/_shared/folhaImportacaoRegras";

const db = supabase as any;
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function chamarFolha(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("folha-operacoes", { body });
  const msg = (data as any)?.error || (error ? await (error as any).context?.json?.().then((j: any) => j?.error).catch(() => null) || error.message : null);
  if (msg) throw new Error(msg);
  return data;
}

/* ---------------- Painel ---------------- */
export function PainelFolha({ comp, unidadeAtualId, versao = 0 }: { comp: string; unidadeAtualId?: string; versao?: number }) {
  const { unidadesPermitidas } = useUnidade();
  const [filtro, setFiltro] = useState<string>("atual");
  const [mes, setMes] = useState(comp);
  const [dados, setDados] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => setMes(comp), [comp]);
  const alvo = useMemo(() => filtro === "todas" ? unidadesPermitidas.map((u) => u.id) : filtro === "atual" ? [unidadeAtualId].filter(Boolean) as string[] : [filtro], [filtro, unidadesPermitidas, unidadeAtualId]);
  useEffect(() => {
    if (!alvo.length) return;
    setErro(null);
    chamarFolha({ acao: "painel", competencia: mes, unidades: alvo }).then(setDados).catch((e) => setErro(e.message));
  }, [mes, alvo.join(","), versao]);
  const tot = (dados?.unidades || []).reduce((a: any, u: any) => ({ colab: a.colab + u.colaboradores, total: a.total + u.total, pagos: a.pagos + u.pagos, vpago: a.vpago + u.valor_pago, pend: a.pend + u.pendentes, vpend: a.vpend + u.valor_pendente }), { colab: 0, total: 0, pagos: 0, vpago: 0, pend: 0, vpend: 0 });
  const evol = useMemo(() => {
    const m: Record<string, any> = {};
    (dados?.unidades || []).forEach((u: any) => u.evolucao.forEach((e: any) => { (m[e.competencia] ||= { competencia: e.competencia, total: 0 }).total += e.total; }));
    return Object.values(m);
  }, [dados]);
  const comp0 = (dados?.unidades || []).reduce((a: any, u: any) => { for (const k in u.composicao) a[k] = (a[k] || 0) + u.composicao[k]; return a; }, {} as Record<string, number>);
  const rot: Record<string, string> = { base: "Bolsa/Salário", passagem: "Passagem", adicionais: "Adicionais", comissao: "Comissão", descontos: "Descontos (−)", contracheque_importado: "Contracheques importados" };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div><Label htmlFor="pmes">Competência</Label><Input id="pmes" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-40" /></div>
        <div><Label>Unidade</Label>
          <Select value={filtro} onValueChange={setFiltro}><SelectTrigger className="w-56" aria-label="Unidade do painel"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="atual">Unidade selecionada</SelectItem>{unidadesPermitidas.length > 1 && <SelectItem value="todas">Todas as minhas unidades</SelectItem>}
              {unidadesPermitidas.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {erro && <Card><CardContent className="p-4 text-sm text-destructive">{erro}</CardContent></Card>}
      {dados && <>
        {dados.negadas > 0 && <p className="text-xs text-muted-foreground">{dados.negadas} unidade(s) sem permissão foram omitidas.</p>}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="painel-kpis">
          {[["Colaboradores", String(tot.colab)], ["Total da folha", brl(tot.total)], ["Pagos", `${tot.pagos} · ${brl(tot.vpago)}`], ["Pendentes", `${tot.pend} · ${brl(tot.vpend)}`], ["Situação", (dados.unidades || []).every((u: any) => u.fechada) ? "Fechada" : "Aberta/prévia"]].map(([l, v]) =>
            <Card key={l}><CardContent className="p-3"><p className="text-xs uppercase text-muted-foreground">{l}</p><p className="font-bold break-words">{v}</p></CardContent></Card>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card><CardHeader><CardTitle className="text-base">Evolução mensal</CardTitle></CardHeader><CardContent className="h-56">
            <ResponsiveContainer><BarChart data={evol}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="competencia" fontSize={11} /><YAxis fontSize={11} width={60} /><Tooltip formatter={(v: any) => brl(v)} /><Bar dataKey="total" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer>
          </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Composição</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
            {Object.entries(rot).map(([k, l]) => <div key={k} className="flex justify-between border-b py-1"><span>{l}</span><span>{brl(comp0[k] || 0)}</span></div>)}
          </CardContent></Card>
        </div>
        {dados.unidades.length > 1 && <Card><CardHeader><CardTitle className="text-base">Comparação entre unidades</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
          {dados.unidades.map((u: any) => <div key={u.unidade_id} className="flex flex-wrap justify-between gap-2 border-b py-1"><span className="font-medium">{u.nome}</span><span>{u.colaboradores} colab. · {brl(u.total)} · {u.fechada ? "fechada" : "aberta"}</span></div>)}
        </CardContent></Card>}
        <p className="text-xs text-muted-foreground">Meses fechados usam o retrato gravado no fechamento; meses abertos são recalculados no servidor com o mesmo motor da folha.</p>
      </>}
    </div>
  );
}

/* ---------------- Importação ---------------- */
type Linha = { pagina: number | null; nome_lido: string; funcao: string; bruto: string; liquido: string; colaborador_id: string };
export function ImportarContracheques({ comp, unidadeId, fechada, colabs, podeImportar, podeDocumentos, podeOriginal = false, onFeito, toast }: {
  comp: string; unidadeId?: string; fechada: boolean; colabs: { id: string; nome: string; tipo: string; ativo: boolean }[];
  podeImportar: boolean; podeDocumentos: boolean; podeOriginal?: boolean; onFeito: () => void; toast: (t: any) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, setLeitura] = useState<Leitura | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [confirmaComp, setConfirmaComp] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [lista, setLista] = useState<any[]>([]);
  const contextoAtual = useRef({ comp, unidadeId });
  contextoAtual.current = { comp, unidadeId };
  const [contextoRevisao, setContextoRevisao] = useState<{ comp: string; unidadeId?: string } | null>(null);
  const revisaoValida = !!contextoRevisao && contextoImportacaoValido({ competencia: contextoRevisao.comp, unidade: contextoRevisao.unidadeId || "" }, { competencia: comp, unidade: unidadeId || "" });
  const clts = colabs.filter((c) => c.tipo === "CLT");
  const carregar = useCallback(async () => {
    if (!unidadeId) return;
    const { data } = await db.from("folha_contracheques").select("*, itens:folha_contracheque_itens(id, colaborador_id, liquido, liquido_original, motivo_correcao, corrigido_em, bruto, nome_lido, ativo)").eq("unidade_id", unidadeId).order("created_at", { ascending: false }).limit(50);
    setLista(data || []);
  }, [unidadeId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function escolher(f: File | null) {
    const contexto = { comp, unidadeId };
    setContextoRevisao(contexto);
    setArquivo(f); setLeitura(null); setLinhas([]); setMsg(null); setConfirmaComp(false);
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setMsg("Arquivo maior que 10 MB");
    try {
      setOcupado(true);
      const r = await lerArquivo(f);
      if (contextoAtual.current.comp !== contexto.comp || contextoAtual.current.unidadeId !== contexto.unidadeId) return;
      setLeitura(r);
      setLinhas(r.itens.map((i) => ({ pagina: i.pagina, nome_lido: i.nome, funcao: i.funcao, bruto: i.bruto == null ? "" : String(i.bruto).replace(".", ","), liquido: i.liquido == null ? "" : String(i.liquido).replace(".", ","), colaborador_id: sugerirColaborador(i.nome, clts) || "" })));
      if (r.aviso) setMsg(r.aviso);
    } catch (e: any) { setMsg(e.message); } finally { setOcupado(false); }
  }
  const valor = (s: string) => (s.trim() === "" ? null : moneyBR(s));
  async function confirmar() {
    if (!arquivo || !leitura || !unidadeId) return;
    if (!revisaoValida) return setMsg("Competência ou unidade alterada: selecione e revise o arquivo novamente.");
    const itens = linhas.map((l) => ({ colaborador_id: l.colaborador_id, liquido: valor(l.liquido), bruto: valor(l.bruto) ?? 0, pagina: l.pagina, nome_lido: l.nome_lido, funcao: l.funcao }));
    const e = validarImportacao(itens, comp, leitura.ref, confirmaComp);
    if (e) return setMsg(e);
    setOcupado(true); setMsg(null);
    let tentativaId: string | undefined;
    try {
      const tentativa = await chamarFolha({ acao: "preparar_importacao", unidade_id: unidadeId, competencia: comp, formato: leitura.formato });
      tentativaId = tentativa.tentativa_id;
      const path = tentativa.arquivo_path;
      if (contextoAtual.current.comp !== comp || contextoAtual.current.unidadeId !== unidadeId) throw new Error("Competência ou unidade alterada: revise novamente.");
      const up = await supabase.storage.from("folha-documentos").upload(path, arquivo, { upsert: false, contentType: arquivo.type || undefined });
      if (up.error) throw up.error;
      const r = await chamarFolha({ acao: "importar_contracheque", tentativa_id: tentativaId, competencia_revisada: contextoRevisao?.comp, unidade_id: unidadeId, competencia: comp, arquivo_path: path, arquivo_nome: arquivo.name, formato: leitura.formato, extracao: leitura.extracao, referencia_detectada: leitura.ref, competencia_confirmada: confirmaComp, itens });
      toast({ title: "Contracheques importados", description: `${r.itens} item(ns) · líquido ${brl(r.total_liquido)}` });
      setArquivo(null); setLeitura(null); setLinhas([]); carregar(); onFeito();
    } catch (err: any) {
      let aviso = "";
      if (tentativaId) {
        try { await chamarFolha({ acao: "limpar_tentativa", tentativa_id: tentativaId }); }
        catch { aviso = " Limpeza temporária não confirmada; tente novamente mais tarde."; }
      }
      setMsg(err.message + aviso);
    } finally { setOcupado(false); }
  }
  async function apagar(id: string) {
    if (!confirm("Apagar esta importação? Os valores lidos voltam ao cálculo normal.")) return;
    try { await chamarFolha({ acao: "apagar_contracheque", contracheque_id: id }); toast({ title: "Importação apagada" }); carregar(); onFeito(); } catch (e: any) { toast({ title: "Não foi possível apagar", description: e.message, variant: "destructive" }); }
  }
  async function baixar(id: string) {
    try { const r = await chamarFolha({ acao: "link_documento", contracheque_id: id }); window.open(r.url, "_blank", "noopener"); } catch (e: any) { toast({ title: "Sem acesso ao documento", description: e.message, variant: "destructive" }); }
  }
  async function corrigir(i: any) {
    const v = prompt(`Novo valor líquido para ${nomeColab(i.colaborador_id)} (atual ${brl(i.liquido)})`);
    if (v == null) return;
    const n = moneyBR(v); if (!Number.isFinite(n) || n < 0) return toast({ title: "Valor inválido", variant: "destructive" });
    const motivo = prompt("Motivo da correção (obrigatório)") || "";
    try { const r = await chamarFolha({ acao: "corrigir_contracheque", item_id: i.id, liquido: n, motivo }); toast({ title: "Importação corrigida", description: `${brl(r.anterior)} → ${brl(r.novo)}` }); carregar(); onFeito(); }
    catch (e: any) { toast({ title: "Correção recusada", description: e.message, variant: "destructive" }); }
  }
  const nomeColab = (id: string) => colabs.find((c) => c.id === id)?.nome || "—";
  return (
    <div className="space-y-3">
      {podeImportar && !fechada && <Card><CardHeader><CardTitle className="text-base">Importar contracheques (CLT) — {comp}</CardTitle>
        <p className="text-xs text-muted-foreground">PDF com texto, Excel (.xlsx, .xls) ou .csv. A leitura é feita no seu aparelho; nada é enviado a serviços externos. PDF escaneado exige preenchimento manual (OCR desativado). O valor importado substitui o cálculo do mês — nunca é somado.</p></CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" aria-label="Arquivo de contracheque" accept=".pdf,.xlsx,.xls,.csv,application/pdf" disabled={ocupado} onChange={(e) => escolher(e.target.files?.[0] || null)} />
          {leitura && !revisaoValida && <p role="alert" className="text-sm text-destructive">Competência ou unidade alterada: selecione e revise o arquivo novamente. Prévia de {contextoRevisao?.comp}.</p>}
          {leitura && <div className="text-sm space-y-2">
            <p>Arquivo <b>{arquivo?.name}</b> · leitura: {leitura.extracao === "texto_pdf" ? "texto do PDF" : leitura.extracao === "planilha" ? "planilha" : "manual (OCR pendente)"} · referência detectada: <b>{leitura.ref || "não identificada"}</b>{leitura.ref && leitura.ref !== comp && <span className="text-destructive"> — diferente da folha ({comp})</span>}</p>
            {!leitura.ref && <label className="flex items-center gap-2"><Switch checked={confirmaComp} onCheckedChange={setConfirmaComp} aria-label="Confirmo a competência" />Conferi o documento: é da competência {comp}</label>}
            <div className="overflow-x-auto"><table className="text-sm min-w-[720px] w-full"><thead><tr className="text-left"><th>Pág.</th><th>Nome lido</th><th>Função</th><th>Bruto</th><th>Líquido</th><th>Colaborador</th><th></th></tr></thead><tbody>
              {linhas.map((l, i) => { const set = (p: Partial<Linha>) => setLinhas(linhas.map((x, j) => j === i ? { ...x, ...p } : x)); return (
                <tr key={i} className="align-top"><td className="p-1">{l.pagina ?? "—"}</td>
                  <td className="p-1"><Input className="h-8" value={l.nome_lido} onChange={(e) => set({ nome_lido: e.target.value.toUpperCase() })} /></td>
                  <td className="p-1"><Input className="h-8" value={l.funcao} onChange={(e) => set({ funcao: e.target.value.toUpperCase() })} /></td>
                  <td className="p-1"><Input className="h-8 w-28" inputMode="decimal" value={l.bruto} placeholder="0,00" onChange={(e) => set({ bruto: e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 w-28" inputMode="decimal" value={l.liquido} placeholder="0,00" aria-label={`Líquido linha ${i + 1}`} onChange={(e) => set({ liquido: e.target.value })} /></td>
                  <td className="p-1"><Select value={l.colaborador_id} onValueChange={(v) => set({ colaborador_id: v })}><SelectTrigger className="h-8 w-56" aria-label={`Colaborador linha ${i + 1}`}><SelectValue placeholder="Associar…" /></SelectTrigger>
                    <SelectContent>{clts.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></td>
                  <td className="p-1"><Button size="sm" variant="ghost" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}>Remover</Button></td></tr>); })}
            </tbody></table></div>
            {leitura.extracao !== "planilha" && <Button size="sm" variant="outline" onClick={() => setLinhas([...linhas, { pagina: null, nome_lido: "", funcao: "", bruto: "", liquido: "", colaborador_id: "" }])}>Adicionar linha</Button>}
            <div className="flex gap-2"><Button onClick={confirmar} disabled={ocupado || !linhas.length || !revisaoValida}>Confirmar importação</Button><Button variant="outline" onClick={() => escolher(null)}>Cancelar</Button></div>
          </div>}
          {msg && <p className="text-sm text-destructive" role="alert">{msg}</p>}
        </CardContent></Card>}
      {fechada && <p className="text-sm text-muted-foreground">Competência fechada: importações congeladas.</p>}
      <Card><CardHeader><CardTitle className="text-base">Contracheques importados</CardTitle></CardHeader><CardContent className="space-y-2">
        {lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma importação.</p>}
        {lista.map((k) => (
          <div key={k.id} className="border rounded-md p-3 text-sm space-y-1">
            <div className="flex flex-wrap justify-between gap-2"><span className="font-medium break-all">{k.arquivo_nome}</span>
              <span className="flex gap-2 items-center"><Badge variant="outline">Contracheque oficial importado</Badge><Badge variant={k.status === "confirmado" ? "default" : "secondary"}>{k.status === "confirmado" ? "Ativo" : "Apagado"}</Badge></span></div>
            <p className="text-muted-foreground">{k.competencia} · {k.extracao === "texto_pdf" ? "texto do PDF" : k.extracao === "planilha" ? "planilha" : "preenchimento manual"} · líquido {brl(k.total_liquido)} · {new Date(k.created_at).toLocaleString("pt-BR")}</p>
            {(k.itens || []).map((i: any) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span>{nomeColab(i.colaborador_id)}: <b>{brl(i.liquido)}</b>{i.liquido_original != null && ` (lido ${brl(i.liquido_original)}; corrigido em ${new Date(i.corrigido_em).toLocaleString("pt-BR")} — ${i.motivo_correcao})`}</span>
                {podeImportar && i.ativo && k.status === "confirmado" && !fechada && k.competencia === comp && <Button size="sm" variant="outline" className="h-7" onClick={() => corrigir(i)}>Corrigir valor</Button>}
              </div>))}
            <div className="flex gap-2">{podeOriginal && <Button size="sm" variant="outline" onClick={() => baixar(k.id)}>Baixar original</Button>}
              {podeImportar && k.status === "confirmado" && !fechada && k.competencia === comp && <Button size="sm" variant="ghost" onClick={() => apagar(k.id)}>Apagar importação</Button>}</div>
          </div>))}
      </CardContent></Card>
    </div>
  );
}

/* ---------------- Exportação ---------------- */
export function ExportarFolha({ comp, unidadeId, toast }: { comp: string; unidadeId?: string; toast: (t: any) => void }) {
  const [dados, setDados] = useState<DadosExport | null>(null);
  const [filtro, setFiltro] = useState("todos");
  const [sep, setSep] = useState(false);
  const [esc, setEsc] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { if (!unidadeId) return; setDados(null); setErro(null); chamarFolha({ acao: "dados_exportacao", competencia: comp, unidades: [unidadeId] }).then(setDados).catch((e) => setErro(e.message)); }, [comp, unidadeId]);
  function exportar() {
    if (!dados) return;
    const L = filtrar(dados.linhas as any, filtro, esc);
    if (!L.length) return toast({ title: "Nenhum colaborador no filtro", variant: "destructive" });
    for (const f of gerarPdfs(dados, L, sep)) { const a = document.createElement("a"); a.href = URL.createObjectURL(f.blob); a.download = f.nome; document.body.appendChild(a); a.click(); a.remove(); }
    toast({ title: "PDF gerado", description: `${L.length} colaborador(es) · total ${brl(L.reduce((a, l) => a + l.resultado.total, 0))}` });
  }
  if (erro) return <Card><CardContent className="p-4 text-sm text-destructive">{erro}</CardContent></Card>;
  return (
    <div><RelacaoPagamentos comp={comp} unidadeId={unidadeId} /><Card><CardHeader><CardTitle className="text-base">Exportar folha em PDF</CardTitle><p className="text-xs text-muted-foreground">{AVISO_INTERNO}. Valores calculados pelo servidor{dados?.fechada ? " a partir do retrato do fechamento" : " (competência aberta: prévia)"}.</p></CardHeader>
      <CardContent className="space-y-3">
        {!dados ? <p className="text-sm text-muted-foreground">Carregando…</p> : <>
          <p className="text-sm">Total do servidor: <b data-testid="total-exportacao">{brl(dados.total)}</b> · {dados.linhas.length} colaborador(es)</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label>Quem exportar</Label><Select value={filtro} onValueChange={setFiltro}><SelectTrigger className="w-60" aria-label="Quem exportar"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="todos">Todos os funcionários</SelectItem><SelectItem value="ESTAGIARIO">Só estagiários</SelectItem><SelectItem value="CLT">Só CLTs</SelectItem>
              <SelectItem value="T:manha">Turno da manhã</SelectItem><SelectItem value="T:tarde">Turno da tarde</SelectItem><SelectItem value="T:noite">Turno da noite</SelectItem><SelectItem value="pick">Escolher funcionários…</SelectItem></SelectContent></Select></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={sep} onCheckedChange={setSep} />Arquivos individuais</label>
            <Button onClick={exportar}>Exportar PDF</Button>
          </div>
          {filtro === "pick" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">{dados.linhas.map((l: any) => <label key={l.colaborador.id} className="flex items-center gap-2 text-sm"><Switch checked={esc.has(l.colaborador.id)} onCheckedChange={(v) => { const n = new Set(esc); v ? n.add(l.colaborador.id) : n.delete(l.colaborador.id); setEsc(n); }} />{l.colaborador.nome}</label>)}</div>}
        </>}
      </CardContent></Card></div>
  );
}
