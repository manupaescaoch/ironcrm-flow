import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { chamarFolha } from "@/components/folha/FolhaExtras";
import { LoteClara } from "@/components/folha/LoteClara";
import { SeletorCompetencia, FluxoMes, nomeMes } from "@/components/folha/ConferenciaMensal";
import { perfilFolhaPermitido } from "@/lib/folha/acesso";
import { calcularAjudaMensal, type AjudaMensal, type AjusteAjuda } from "@/lib/folha/ajudaMensal";

type Colab = { id: string; nome: string; funcao: string | null; passagem: number; ativo: boolean; pix?: string | null };
type Lanc = { id: string; colaborador_id: string; dados: AjudaMensal; updated_at?: string };
type Parcela = { id: string; colaborador_id: string; parcela: 1 | 2; valor: number; data_prevista: string | null; status: string };

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeComp = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const db = supabase as any;
const int = (v: string) => (v === "" ? undefined : Math.max(0, Math.floor(Number(v) || 0)));
const dec = (v: string) => (v === "" ? undefined : Math.max(0, Number(String(v).replace(",", ".")) || 0));

/** Dias de segunda a sexta do mês — apenas SUGESTÃO, nunca preenchida automaticamente. */
function sugestaoDiasUteis(comp: string) {
  const [a, m] = comp.split("-").map(Number); let n = 0;
  for (let d = 1; d <= new Date(a, m, 0).getDate(); d++) { const w = new Date(a, m - 1, d).getDay(); if (w > 0 && w < 6) n++; }
  return n;
}
function calc(d: AjudaMensal) { try { return { r: calcularAjudaMensal(d), erro: null as string | null }; } catch (e) { return { r: null, erro: (e as Error).message }; } }
function pendenciasAjuda(c: Colab, d: AjudaMensal, erro: string | null) {
  const p: string[] = [];
  if (erro) p.push(erro);
  if (d.dias_uteis == null) p.push("Dias úteis");
  if (!d.passagem_dia) p.push("Passagem diária");
  if (d.dias_alimentacao == null) p.push("Dias de alimentação");
  if (!(d.datas?.[0] && d.datas?.[1])) p.push("Datas das parcelas");
  if (!c.pix) p.push("PIX ausente");
  return p;
}

export default function AjudaCusto() {
  const { user, isAdmin, userRole, loading: authLoading } = useAuth();
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const unidadeId = unidadeAtual?.id;
  const [perms, setPerms] = useState<string[] | null>(null);
  const perfilOk = perfilFolhaPermitido(userRole);
  const pode = !perfilOk ? false : perms == null ? null : perms.includes("ver");
  const tem = (a: string) => !!perms?.includes(a);
  const [comp, setComp] = useState(hojeComp());
  const [colabs, setColabs] = useState<Colab[]>([]);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [fechadaRow, setFechadaRow] = useState<any>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [legado, setLegado] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);

  useEffect(() => {
    let ativo = true; setPerms(null);
    if (!user || !unidadeId || !perfilOk) return;
    db.rpc("folha_minhas_permissoes", { _unidade_id: unidadeId }).then(({ data, error }: any) => { if (ativo) setPerms(error ? [] : data || []); });
    return () => { ativo = false; };
  }, [user, unidadeId, perfilOk]);

  const carregar = useCallback(async () => {
    if (!unidadeId || !pode) return;
    const r = await chamarFolha({ acao: "ajuda_dados", unidade_id: unidadeId, competencia: comp });
    setFalha(null);
    setColabs((r.colaboradores || []).map((c: any) => ({ ...c, passagem: Number(c.passagem) })));
    setLancs(r.lancamentos || []); setFechadaRow(r.competencia || null); setParcelas(r.parcelas || []); setLegado(!!r.legado);
  }, [unidadeId, pode, comp]);
  useEffect(() => { setSelecionado(null); setSujo(false); carregar().catch((e) => setFalha(e?.message || "Falha ao carregar")); }, [carregar]);

  const fechada = fechadaRow?.status === "fechada";
  const snapLanc: Lanc[] = fechada ? fechadaRow?.snapshot?.lancamentos || [] : lancs;
  const snapColabs: Colab[] = fechada ? fechadaRow?.snapshot?.colaboradores || [] : colabs;
  const linhas = useMemo(() => snapLanc.map((l) => {
    const c = snapColabs.find((x) => x.id === l.colaborador_id) || colabs.find((x) => x.id === l.colaborador_id) || { id: l.colaborador_id, nome: "—", funcao: null, passagem: 0, ativo: false };
    const { r, erro } = calc(l.dados || {});
    return { c, l, r, erro, pend: pendenciasAjuda(c, l.dados || {}, erro) };
  }).sort((a, b) => a.c.nome.localeCompare(b.c.nome)), [snapLanc, snapColabs, colabs]);
  const total = linhas.reduce((a, x) => a + (x.r?.total ?? 0), 0);
  const comPend = linhas.filter((x) => x.pend.length).length;
  const preparados = new Set(lancs.map((l) => l.colaborador_id));
  const faltam = colabs.filter((c) => c.ativo && !preparados.has(c.id));

  function trocar(c: string) {
    if (sujo && !window.confirm("Há uma edição não salva nesta ajuda. Trocar de mês e descartar?")) return;
    setComp(c);
  }
  const erro = (e: any) => toast({ title: "Não foi possível concluir", description: e?.message || String(e), variant: "destructive" });
  async function op(body: Record<string, unknown>, ok: string) {
    try { const r = await chamarFolha({ ...body, unidade_id: unidadeId, competencia: comp }); toast({ title: ok }); await carregar(); return r; } catch (e) { erro(e); return null; }
  }

  if (authLoading || pode == null) return <Layout><div className="p-6 text-muted-foreground" role="status">Verificando acesso…</div></Layout>;
  if (pode === false) return <Layout><div className="p-6"><Card><CardContent className="p-6 text-muted-foreground">Você não tem acesso à Ajuda de Custo.</CardContent></Card></div></Layout>;

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 max-w-full overflow-x-hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><HandCoins className="w-6 h-6 text-primary" /> Ajuda de Custo</h1>
          <p className="text-sm text-muted-foreground">Unidade {unidadeAtual?.nome} · CLT · separada do salário, da comissão e de Contas a Pagar</p>
        </div>
        <SeletorCompetencia comp={comp} onChange={trocar} status={fechada ? "fechada" : lancs.length ? "aberta" : "sem_folha"} />
        <FluxoMes etapas={[
          { label: "Preparar mês", feito: fechada || lancs.length > 0, atual: !fechada && !lancs.length },
          { label: "Revisar colaboradores", feito: fechada || (lancs.length > 0 && !faltam.length) },
          { label: "Preencher dias e valores", feito: fechada || (lancs.length > 0 && comPend === 0), atual: !fechada && lancs.length > 0 && comPend > 0 },
          { label: "Conferir", feito: fechada, atual: !fechada && lancs.length > 0 && comPend === 0 },
          { label: "Fechar ajuda", feito: fechada },
          { label: "Exportar parcela 1 ou 2", feito: false, atual: fechada },
        ]} />

        {falha && <Card><CardContent className="p-4 text-destructive" role="alert">{falha}</CardContent></Card>}
        {legado && <Card><CardContent className="p-4 text-sm">Este mês já tem parcelas de ajuda geradas pelo fechamento da folha salarial. Elas continuam valendo e podem ser exportadas pela Folha; esta página não cria uma segunda ajuda para o mesmo mês.</CardContent></Card>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total do mês</p><p className="text-xl font-bold">{brl(total)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Colaboradores</p><p className="text-xl font-bold">{linhas.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Com pendência</p><p className="text-xl font-bold">{comPend}</p></CardContent></Card>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {!fechada && !legado && tem("lancar") && faltam.length > 0 && <Preparar comp={comp} faltam={faltam} temLancs={lancs.length > 0} onConfirmar={(ids) => op({ acao: "ajuda_preparar", colaborador_ids: ids }, `Ajuda de ${nomeMes(comp)} preparada`)} />}
          {!fechada && !legado && tem("fechar") && lancs.length > 0 && <Button disabled={comPend > 0 || sujo} onClick={() => op({ acao: "ajuda_fechar" }, "Ajuda de custo fechada — valores congelados pelo servidor")}>Fechar ajuda de custo</Button>}
          {fechada && unidadeId && tem("documentos") && tem("dados_pessoais") && <>
            <LoteClara parcela={1} comp={comp} unidadeId={unidadeId} unidadeNome={unidadeAtual?.nome || ""} onFeito={carregar} />
            <LoteClara parcela={2} comp={comp} unidadeId={unidadeId} unidadeNome={unidadeAtual?.nome || ""} onFeito={carregar} />
          </>}
          {fechada && isAdmin && <Button variant="outline" onClick={() => { const m = window.prompt("Motivo da reabertura"); if (m?.trim()) op({ acao: "ajuda_reabrir", motivo: m }, "Ajuda reaberta"); }}>Reabrir</Button>}
          {fechada && <p className="text-sm text-muted-foreground">Fechada em {fechadaRow?.fechada_em ? new Date(fechadaRow.fechada_em).toLocaleString("pt-BR") : "—"}. Exportar não confirma pagamento nem faz transferência.</p>}
          {!fechada && comPend > 0 && <p className="text-sm text-muted-foreground">{comPend} colaborador(es) com pendência — o fechamento fica bloqueado.</p>}
        </div>

        {linhas.length === 0 && !falha && <Card><CardContent className="p-6 text-muted-foreground">Nenhuma ajuda preparada para {nomeMes(comp)}.</CardContent></Card>}

        {linhas.length > 0 && (
          <div className="hidden md:block border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr className="text-left">
                  <th className="p-2">Colaborador</th><th className="p-2 text-right">Pass./dia</th><th className="p-2 text-right">Dias úteis</th><th className="p-2 text-right">Pass. úteis</th>
                  <th className="p-2 text-right">Dias FDS/fer.</th><th className="p-2 text-right">Pass. adicional</th><th className="p-2 text-right">Alim./dia</th><th className="p-2 text-right">Dias alim.</th>
                  <th className="p-2 text-right">Alimentação</th><th className="p-2 text-right">Ajustes</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">1ª parcela</th><th className="p-2 text-right">2ª parcela</th><th className="p-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ c, l, r, pend }) => { const d = l.dados || {}; return (
                  <tr key={c.id} onClick={() => setSelecionado(selecionado === c.id ? null : c.id)} className={cn("border-t cursor-pointer hover:bg-muted/40", selecionado === c.id && "bg-primary/5")}>
                    <td className="p-2"><p className="font-medium">{c.nome}</p><p className="text-xs text-muted-foreground">{c.funcao || "CLT"}</p></td>
                    <td className="p-2 text-right">{brl(d.passagem_dia ?? 0)}</td><td className="p-2 text-right">{d.dias_uteis ?? "—"}</td><td className="p-2 text-right">{r ? brl(r.passagemUteis) : "—"}</td>
                    <td className="p-2 text-right">{d.dias_adicionais ?? 0}</td><td className="p-2 text-right">{r ? brl(r.passagemAdicional) : "—"}{r?.passagemManual && <p className="text-[10px] text-primary">manual</p>}</td>
                    <td className="p-2 text-right">{brl(d.alimentacao_dia ?? 0)}</td><td className="p-2 text-right">{d.dias_alimentacao ?? "—"}</td><td className="p-2 text-right">{r ? brl(r.alimentacao) : "—"}</td>
                    <td className="p-2 text-right">{r ? brl(r.ajustes) : "—"}</td><td className="p-2 text-right font-bold">{r ? brl(r.total) : "—"}</td>
                    <td className="p-2 text-right text-xs">{r ? brl(r.parcelas[0]) : "—"}<p className="text-muted-foreground">{d.datas?.[0] || "sem data"}</p></td>
                    <td className="p-2 text-right text-xs">{r ? brl(r.parcelas[1]) : "—"}<p className="text-muted-foreground">{d.datas?.[1] || "sem data"}</p></td>
                    <td className="p-2">{pend.length ? <span className="text-xs text-destructive">{pend.join(" · ")}</span> : <Badge variant="secondary">Completo</Badge>}</td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        )}

        {linhas.map(({ c, l, r, pend }) => (
          <div key={`${unidadeId}-${comp}-${c.id}`} className={cn(selecionado === c.id ? "" : "md:hidden")}>
            <EditorAjuda comp={comp} colab={c} lanc={l} total={r?.total ?? null} parcelas={r?.parcelas ?? null} pend={pend}
              aberto={selecionado === c.id} onAbrir={() => setSelecionado(selecionado === c.id ? null : c.id)}
              bloqueada={fechada || !tem("lancar")} onSujo={setSujo}
              onSalvar={(dados) => op({ acao: "ajuda_salvar", lancamento_id: l.id, dados }, "Ajuda salva").then((x) => !!x)} />
          </div>
        ))}
      </div>
    </Layout>
  );
}

function Preparar({ comp, faltam, temLancs, onConfirmar }: { comp: string; faltam: Colab[]; temLancs: boolean; onConfirmar: (ids: string[]) => Promise<unknown> }) {
  const [aberto, setAberto] = useState(false), [busy, setBusy] = useState(false);
  const [marc, setMarc] = useState<Set<string>>(new Set());
  return (<>
    <Button size="lg" onClick={() => { setMarc(new Set(faltam.map((c) => c.id))); setAberto(true); }}>{temLancs ? `Incluir ${faltam.length} colaborador(es)` : `Preparar ajuda de ${nomeMes(comp)}`}</Button>
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Preparar ajuda de {nomeMes(comp)}</DialogTitle>
          <DialogDescription>Inclui somente os colaboradores CLT marcados e cria apenas o que ainda não existe. Do cadastro vem só a passagem diária, para revisão. Dias, ajustes, datas e pagamentos não são copiados.</DialogDescription></DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-1">
          {faltam.map((c) => <label key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 text-sm">
            <Checkbox checked={marc.has(c.id)} onCheckedChange={(v) => { const n = new Set(marc); v ? n.add(c.id) : n.delete(c.id); setMarc(n); }} />
            <span className="flex-1">{c.nome}<span className="text-muted-foreground"> · passagem/dia {c.passagem ? brl(c.passagem) : "— a preencher"}</span></span>
          </label>)}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button disabled={busy || !marc.size} onClick={async () => { setBusy(true); try { await onConfirmar([...marc]); setAberto(false); } finally { setBusy(false); } }}>Incluir {marc.size}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>);
}

function Num({ label, value, onChange, disabled, decimal }: { label: string; value?: number; onChange: (v?: number) => void; disabled: boolean; decimal?: boolean }) {
  return <div><Label className="text-xs">{label}</Label><Input type="number" inputMode={decimal ? "decimal" : "numeric"} min={0} step={decimal ? "0.01" : "1"} disabled={disabled} placeholder="A preencher" value={value ?? ""} onChange={(e) => onChange(decimal ? dec(e.target.value) : int(e.target.value))} /></div>;
}

function EditorAjuda({ comp, colab, lanc, total, parcelas, pend, aberto, onAbrir, bloqueada, onSalvar, onSujo }: {
  comp: string; colab: Colab; lanc: Lanc; total: number | null; parcelas: [number, number] | null; pend: string[]; aberto: boolean; onAbrir: () => void; bloqueada: boolean;
  onSalvar: (d: AjudaMensal) => Promise<boolean>; onSujo: (v: boolean) => void;
}) {
  const [d, setD] = useState<AjudaMensal>(lanc.dados || {});
  const [sujo, setSujoL] = useState(false);
  useEffect(() => { if (!sujo) setD(lanc.dados || {}); }, [lanc.dados, lanc.updated_at]);
  const ed = (n: AjudaMensal) => { setD(n); setSujoL(true); onSujo(true); };
  const { r, erro } = calc(d);
  const sug = sugestaoDiasUteis(comp);
  const manual = !!d.passagem_adicional_manual;
  const set = (k: keyof AjudaMensal) => (v?: number) => ed({ ...d, [k]: v });
  return (
    <Card>
      <button className="w-full text-left p-4 flex flex-wrap items-center justify-between gap-2" onClick={onAbrir}>
        <div><p className="font-semibold">{colab.nome}{sujo && <Badge variant="outline" className="ml-2 border-primary text-primary">Não salvo</Badge>}</p>
          <p className="text-xs text-muted-foreground">{colab.funcao || "CLT"}</p>{pend.length > 0 && <p className="text-xs text-destructive">{pend.join(" · ")}</p>}</div>
        <div className="text-right"><p className="font-bold">{total == null ? "—" : brl(total)}</p>{parcelas && <p className="text-xs text-muted-foreground">{brl(parcelas[0])} + {brl(parcelas[1])}</p>}</div>
      </button>
      {aberto && <CardContent className="space-y-4 border-t pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Num decimal label="Passagem por dia" value={d.passagem_dia} onChange={set("passagem_dia")} disabled={bloqueada} />
          <div><Num label="Dias úteis considerados" value={d.dias_uteis} onChange={set("dias_uteis")} disabled={bloqueada} />
            {!bloqueada && <button type="button" className="text-[11px] text-primary underline" onClick={() => ed({ ...d, dias_uteis: sug })}>Sugestão do calendário: {sug} (seg–sex, sem feriados) — conferir</button>}</div>
          <Num label="Dias adicionais FDS/feriado" value={d.dias_adicionais} onChange={set("dias_adicionais")} disabled={bloqueada || manual} />
          <div className="flex items-end"><p className="text-sm">Passagem adicional: <b>{r ? brl(r.passagemAdicional) : "—"}</b></p></div>
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm"><Switch disabled={bloqueada} checked={manual} onCheckedChange={(v) => ed({ ...d, passagem_adicional_manual: v ? { valor: 0, motivo: "" } : null })} />Informar passagem adicional manual</label>
          {manual && <>
            <p className="text-xs text-muted-foreground">O valor manual <b>substitui</b> passagem/dia × dias adicionais; não soma de novo.</p>
            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2">
              <Num decimal label="Valor manual" value={d.passagem_adicional_manual!.valor} onChange={(v) => ed({ ...d, passagem_adicional_manual: { ...d.passagem_adicional_manual!, valor: v ?? 0 } })} disabled={bloqueada} />
              <div><Label className="text-xs">Motivo (obrigatório)</Label><Input disabled={bloqueada} value={d.passagem_adicional_manual!.motivo} onChange={(e) => ed({ ...d, passagem_adicional_manual: { ...d.passagem_adicional_manual!, motivo: e.target.value.toUpperCase() } })} /></div>
            </div></>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Num decimal label="Alimentação por dia" value={d.alimentacao_dia} onChange={set("alimentacao_dia")} disabled={bloqueada} />
          <Num label="Dias de alimentação" value={d.dias_alimentacao} onChange={set("dias_alimentacao")} disabled={bloqueada} />
          <div className="flex items-end"><p className="text-sm">Alimentação: <b>{r ? brl(r.alimentacao) : "—"}</b></p></div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Ajustes (não recorrentes)</h3>
          {(d.ajustes || []).map((a) => <div key={a.id} className="grid grid-cols-2 md:grid-cols-[1fr_130px_120px_110px_auto] gap-2">
            <Input aria-label="Descrição" disabled={bloqueada} value={a.descricao} onChange={(e) => ed({ ...d, ajustes: d.ajustes!.map((x) => x.id === a.id ? { ...x, descricao: e.target.value.toUpperCase() } : x) })} />
            <Select disabled={bloqueada} value={a.tipo} onValueChange={(v) => ed({ ...d, ajustes: d.ajustes!.map((x) => x.id === a.id ? { ...x, tipo: v as AjusteAjuda["tipo"] } : x) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="adicional">Positivo</SelectItem><SelectItem value="desconto">Negativo</SelectItem></SelectContent></Select>
            <Input aria-label="Valor" type="number" min={0} step="0.01" disabled={bloqueada} value={a.valor} onChange={(e) => ed({ ...d, ajustes: d.ajustes!.map((x) => x.id === a.id ? { ...x, valor: dec(e.target.value) ?? 0 } : x) })} />
            <Input aria-label="Competência de origem" type="month" disabled={bloqueada} value={a.origem || ""} onChange={(e) => ed({ ...d, ajustes: d.ajustes!.map((x) => x.id === a.id ? { ...x, origem: e.target.value } : x) })} />
            {!bloqueada && <Button variant="outline" onClick={() => ed({ ...d, ajustes: d.ajustes!.filter((x) => x.id !== a.id) })}>Remover</Button>}
          </div>)}
          {!bloqueada && <Button variant="outline" onClick={() => ed({ ...d, ajustes: [...(d.ajustes || []), { id: crypto.randomUUID(), descricao: "", tipo: "adicional", valor: 0, origem: "" }] })}>Adicionar ajuste</Button>}
        </div>
        <div className="grid grid-cols-2 gap-2 max-w-md">{([0, 1] as const).map((i) => <div key={i}><Label className="text-xs">Data da {i + 1}ª parcela · {r ? brl(r.parcelas[i]) : "—"}</Label>
          <Input type="date" disabled={bloqueada} value={d.datas?.[i] || ""} onChange={(e) => { const ds: [string, string] = [...(d.datas ?? ["", ""])] as [string, string]; ds[i] = e.target.value; ed({ ...d, datas: ds }); }} /></div>)}</div>
        {erro ? <p role="alert" className="text-destructive">{erro}</p> : r && <div className="text-sm grid grid-cols-2 md:grid-cols-5 gap-1 bg-muted/40 rounded-md p-3">
          <span>Passagem úteis: {brl(r.passagemUteis)}</span><span>Passagem adicional: {brl(r.passagemAdicional)}</span><span>Alimentação: {brl(r.alimentacao)}</span><span>Ajustes: {brl(r.ajustes)}</span><span className="font-bold">Total: {brl(r.total)}</span></div>}
        {!bloqueada && <Button disabled={!!erro} onClick={async () => { if (await onSalvar(d)) { setSujoL(false); onSujo(false); } }}>Salvar ajuda</Button>}
      </CardContent>}
    </Card>
  );
}
