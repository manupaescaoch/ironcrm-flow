import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Lock, Wallet, Users, Settings2, History, Receipt, BarChart3, FileUp, FileDown } from "lucide-react";
import { PainelFolha, ImportarContracheques, ExportarFolha } from "@/components/folha/FolhaExtras";
import { LoteClara } from "@/components/folha/LoteClara";
import { AjudaCusto } from "@/components/folha/AjudaCusto";
import { perfilFolhaPermitido } from "@/lib/folha/acesso";
import { chamarFolha } from "@/components/folha/FolhaExtras";
import { SeletorCompetencia, FluxoMes, TabelaConferencia, PrepararMes, pendencias, lerRascunho, gravarRascunho, nomeMes, type LinhaConferencia } from "@/components/folha/ConferenciaMensal";
import {
  calcularFolha, mesclarRegras, temSegundoTurno, VERSAO_CALCULO, regrasExplicitas, FUNCOES_REMUNERATORIAS,
  type Colaborador, type Lancamento, type RegrasFolha, type LancTurno,
} from "@/lib/folha/motor";

type ColabRow = Colaborador & { unidade_id: string; cpf: string | null; pix: string | null; ativo: boolean };
type LancRow = { id: string; colaborador_id: string; competencia: string; dados: Lancamento; liquido_importado: number | null };
type PagRow = { id: string; colaborador_id: string; colaborador_nome: string | null; pix: string | null; valor_confirmado: number | null; valor: number; status: "pendente" | "pago"; confirmado_em: string | null; observacao: string | null };
type CompRow = { id: string; status: "aberta" | "fechada"; versao_calculo: string; regras: RegrasFolha | null; snapshot: { colaboradores: ColabRow[]; lancamentos: LancRow[] } | null; fechada_em: string | null };

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeComp = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const num = (v: string) => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : 0; };
const db = supabase as any;

export default function Folha() {
  const { user, isAdmin, userRole, loading: authLoading } = useAuth();
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();
  const [perms, setPerms] = useState<string[] | null>(null);
  const perfilPermitido = perfilFolhaPermitido(userRole);
  const pode = !perfilPermitido ? false : perms == null ? null : perms.includes("ver");
  const tem = (a: string) => !!perms?.includes(a);
  const [comp, setComp] = useState(hojeComp());
  const [regrasAtuais, setRegrasAtuais] = useState<RegrasFolha>(mesclarRegras(null));
  const [colabs, setColabs] = useState<ColabRow[]>([]);
  const [lancs, setLancs] = useState<LancRow[]>([]);
  const [pags, setPags] = useState<PagRow[]>([]);
  const [compRow, setCompRow] = useState<CompRow | null>(null);
  const [aud, setAud] = useState<any[]>([]);
  const [desfazer, setDesfazer] = useState<PagRow | null>(null);
  const [motivo, setMotivo] = useState("");
  // Incrementa após cada leitura confirmada do servidor: painel e exportação recarregam junto com a folha.
  const [versao, setVersao] = useState(0);
  // Falha de leitura/configuração: a prévia não é exibida com defaults ou totais parciais.
  const [falhaCalculo, setFalhaCalculo] = useState<string | null>(null);
  const unidadeId = unidadeAtual?.id;

  useEffect(() => {
    let active = true;
    setPerms(null);
    if (!user || !unidadeAtual?.id || !perfilPermitido) return;
    db.rpc("folha_minhas_permissoes", { _unidade_id: unidadeAtual.id }).then(({ data, error }: any) => {
      if (active) setPerms(error ? [] : data || []);
    });
    return () => { active = false; };
  }, [user, unidadeAtual?.id, perfilPermitido]);

  const carregar = useCallback(async () => {
    if (!unidadeId || !pode) return;
    const cfg = await db.from("folha_config").select("regras").eq("id", 1).maybeSingle();
    if (cfg.error || !cfg.data?.regras) { setFalhaCalculo(cfg.error ? "Falha ao ler as regras da folha" : "Configuração da folha ausente"); return; }
    // Regras carregadas antes do cálculo, para que a configuração continue editável se faltar algum valor.
    setRegrasAtuais(mesclarRegras(cfg.data.regras));
    const [tela, l] = await Promise.all([
      chamarFolha({ acao: "dados_tela", unidade_id: unidadeId, competencia: comp }),
      db.from("folha_lancamentos").select("*").eq("unidade_id", unidadeId).eq("competencia", comp),
    ]);
    if (l.error) { setFalhaCalculo("Falha ao ler os lançamentos do mês"); return; }
    setFalhaCalculo(null);
    setRegrasAtuais(mesclarRegras(cfg.data.regras));
    setColabs((tela.colaboradores || []).map((r: any) => ({ ...r, base: Number(r.base), passagem: Number(r.passagem) })));
    setLancs(l.data || []); setPags(tela.pagamentos || []); setCompRow(tela.competencia || null); setAud(tela.auditoria || []); setVersao((v) => v + 1);
  }, [unidadeId, pode, comp]);
  useEffect(() => { carregar().catch((e) => { setFalhaCalculo(e?.message || "Falha ao carregar a folha"); if (!String(e?.message).startsWith("Cálculo indisponível")) toast({ title: "Não foi possível carregar a folha", description: e.message, variant: "destructive" }); }); }, [carregar]);

  const fechada = compRow?.status === "fechada";
  const regras = fechada && compRow?.regras ? mesclarRegras(compRow.regras, compRow.versao_calculo ?? "historica") : regrasAtuais;
  const colabsMes = fechada && compRow?.snapshot ? compRow.snapshot.colaboradores : colabs;
  const lancsMes = fechada && compRow?.snapshot ? compRow.snapshot.lancamentos : lancs;
  const lancPor = useMemo(() => Object.fromEntries(lancsMes.map((l) => [l.colaborador_id, l])), [lancsMes]);
  // Entra na folha quem tem lançamento na competência, ou está ativo enquanto a competência estiver aberta.
  const calculo = useMemo(() => { try { return { linhas: colabsMes
    .filter((c) => c.tipo !== "SEM_CONTRATO" && (lancPor[c.id] || (!fechada && c.ativo)))
    .map((c) => ({ c, l: lancPor[c.id], r: calcularFolha(c, lancPor[c.id]?.dados, regras, lancPor[c.id]?.liquido_importado ?? null, fechada ? compRow?.versao_calculo ?? "historica" : VERSAO_CALCULO) })), erro: null }; } catch(e) { return {linhas:[],erro:(e as Error).message}; } },
  [colabsMes, lancPor, regras, fechada, compRow?.versao_calculo]);
  const linhas: { c: ColabRow; l: LancRow; r: ReturnType<typeof calcularFolha> }[] = calculo.linhas;
  // Conferência linha a linha: uma pendência de configuração aparece na própria linha, sem esconder as demais.
  const versaoMes = fechada ? compRow?.versao_calculo ?? "historica" : VERSAO_CALCULO;
  const linhasConf: LinhaConferencia[] = useMemo(() => colabsMes
    .filter((c) => c.tipo !== "SEM_CONTRATO" && (lancPor[c.id] || (!fechada && c.ativo)))
    .map((c) => { const l = lancPor[c.id]; try { return { c, l, r: calcularFolha(c, l?.dados, regras, l?.liquido_importado ?? null, versaoMes), erro: null }; } catch (e) { return { c, l, r: null, erro: (e as Error).message }; } }),
  [colabsMes, lancPor, regras, fechada, versaoMes]);
  const preparados = useMemo(() => new Set(lancs.map((l) => l.colaborador_id)), [lancs]);
  const ativosUnidade = useMemo(() => colabs.filter((c) => c.ativo && c.tipo !== "SEM_CONTRATO"), [colabs]);
  const comPendencia = linhasConf.filter((x) => pendencias(x.c, x.l, x.r, x.erro, !fechada).length).length;
  const [aba, setAba] = useState("folha");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [rascunhos, setRascunhos] = useState<Set<string>>(new Set());
  const marcarRascunho = useCallback((id: string, tem: boolean) => setRascunhos((r) => { const n = new Set(r); tem ? n.add(id) : n.delete(id); return n; }), []);
  useEffect(() => { setSelecionado(null); setRascunhos(new Set()); }, [comp, unidadeId]);
  function trocarComp(c: string) {
    if (rascunhos.size) toast({ title: "Edições não salvas guardadas", description: `${rascunhos.size} lançamento(s) de ${nomeMes(comp)} continuam como rascunho neste navegador. Volte ao mês para salvar.` });
    setComp(c);
  }
  async function prepararMes(ids: string[]) {
    // Idempotente: lançamentos existentes não são tocados; só valores fixos do cadastro entram no cálculo.
    const rows = ids.filter((id) => !preparados.has(id)).map((id) => ({ unidade_id: unidadeId, colaborador_id: id, competencia: comp, dados: {}, updated_by: user?.id }));
    if (!rows.length) return;
    const { error } = await db.from("folha_lancamentos").upsert(rows, { onConflict: "colaborador_id,competencia", ignoreDuplicates: true });
    if (error) { erro(error); return; }
    toast({ title: `Folha de ${nomeMes(comp)} preparada`, description: `${rows.length} lançamento(s) criados. Preencha os valores variáveis do mês.` });
    await carregar();
  }
  const totais = useMemo(() => linhas.reduce<{clt:number;est:number;total:number}>((a, x) => ({
    clt: a.clt + (x.c.tipo === "CLT" ? x.r.total : 0), est: a.est + (x.c.tipo === "ESTAGIARIO" ? x.r.total : 0), total: a.total + x.r.total,
  }), { clt: 0, est: 0, total: 0 }), [linhas]);

  const erro = (e: any) => toast({ title: "Não foi possível salvar", description: e?.message || String(e), variant: "destructive" });

  async function salvarLanc(colab: ColabRow, dados: Lancamento, liquido: number | null) {
    const { error } = await db.from("folha_lancamentos").upsert({
      unidade_id: unidadeId, colaborador_id: colab.id, competencia: comp, dados, updated_by: user?.id,
    }, { onConflict: "colaborador_id,competencia" });
    if (error) { erro(error); return false; }
    toast({ title: "Lançamento salvo" }); await carregar(); return true;
  }

  async function operar(body: Record<string, unknown>, ok: string) {
    const { data, error } = await supabase.functions.invoke("folha-operacoes", { body });
    const msg = (data as any)?.error || (error ? await (error as any).context?.json?.().then((j: any) => j?.error).catch(() => null) || error.message : null);
    if (msg) { erro(new Error(msg)); return null; }
    toast({ title: ok }); await carregar(); return data;
  }
  async function fecharCompetencia() {
    await operar({ acao: "fechar", unidade_id: unidadeId, competencia: comp }, `Competência ${comp} fechada — valores calculados e congelados pelo servidor`);
  }
  async function reabrir() { if (!compRow) return; await operar({ acao: "reabrir", competencia_id: compRow.id }, "Competência reaberta"); }

  async function marcarPagamento(p: PagRow, status: "pago" | "pendente") {
    if (status === "pendente") { setMotivo(""); setDesfazer(p); return; }
    await operar({ acao: "confirmar", pagamento_id: p.id },
      status === "pago" ? "Pagamento registrado internamente (nenhum PIX ou transferência foi feito)" : "Pagamento desfeito");
  }

  if (authLoading || pode == null) return <Layout><div className="p-6 text-muted-foreground" role="status">Verificando acesso…</div></Layout>;
  if (pode === false) return <Layout><div className="p-6"><Card><CardContent className="p-6 text-muted-foreground">Você não tem acesso à Folha de Pagamentos.</CardContent></Card></div></Layout>;

  if (falhaCalculo) return <Layout><div className="p-6 space-y-4"><Card><CardContent className="p-6 space-y-3" role="alert"><p className="font-semibold text-destructive">Cálculo indisponível — prévia e exportação interrompidas</p><p className="text-sm text-muted-foreground">{falhaCalculo}. Nenhum total é exibido até que a leitura complete sem erro.</p><Button variant="outline" onClick={() => { setFalhaCalculo(null); carregar().catch((e) => setFalhaCalculo(e?.message || "Falha ao carregar a folha")); }}>Tentar novamente</Button></CardContent></Card>{falhaCalculo.startsWith("Cálculo indisponível") && (tem("regras") ? <Configuracoes regras={regrasAtuais} podeEditar onSalvo={() => { setFalhaCalculo(null); carregar().catch((e) => setFalhaCalculo(e?.message || "Falha ao carregar a folha")); }} erro={erro} /> : <p className="text-sm text-muted-foreground">Peça a um administrador para completar as configurações da folha.</p>)}</div></Layout>;

  const nomeColab = (id: string) => colabsMes.find((c) => c.id === id)?.nome || colabs.find((c) => c.id === id)?.nome || "—";

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 max-w-full overflow-x-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6 text-primary" /> Folha de Pagamentos</h1>
            <p className="text-sm text-muted-foreground">Unidade {unidadeAtual?.nome}</p>
          </div>
        </div>
        <SeletorCompetencia comp={comp} onChange={trocarComp} status={fechada ? "fechada" : compRow || lancs.length ? "aberta" : "sem_folha"} />
        <FluxoMes etapas={[
          { label: "Preparar mês", feito: fechada || (lancs.length > 0 && ativosUnidade.every((c) => preparados.has(c.id))), atual: !fechada && !lancs.length },
          { label: "Preencher lançamentos", feito: fechada || (lancs.length > 0 && comPendencia === 0), atual: !fechada && lancs.length > 0 && comPendencia > 0 },
          { label: "Conferir totais", feito: fechada, atual: !fechada && lancs.length > 0 && comPendencia === 0 },
          { label: "Fechar competência", feito: fechada },
          { label: "Exportar Clara", feito: false, atual: fechada },
        ]} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">CLT</p><p className="text-xl font-bold">{calculo.erro ? "—" : brl(totais.clt)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Estagiários</p><p className="text-xl font-bold">{calculo.erro ? "—" : brl(totais.est)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total da folha</p><p className="text-xl font-bold">{calculo.erro ? "—" : brl(totais.total)}</p></CardContent></Card>
        </div>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="folha"><Receipt className="w-4 h-4 mr-1" />Folha</TabsTrigger>
            <TabsTrigger value="painel"><BarChart3 className="w-4 h-4 mr-1" />Painel</TabsTrigger>
            <TabsTrigger value="pagamentos"><Wallet className="w-4 h-4 mr-1" />Pagamentos</TabsTrigger>
            {(tem("importar") || tem("documentos")) && <TabsTrigger value="contracheques"><FileUp className="w-4 h-4 mr-1" />Contracheques</TabsTrigger>}
            {tem("documentos") && <TabsTrigger value="exportar"><FileDown className="w-4 h-4 mr-1" />Exportar</TabsTrigger>}
            <TabsTrigger value="colaboradores"><Users className="w-4 h-4 mr-1" />Colaboradores</TabsTrigger>
            <TabsTrigger value="historico"><History className="w-4 h-4 mr-1" />Histórico</TabsTrigger>
            <TabsTrigger value="config"><Settings2 className="w-4 h-4 mr-1" />Configurações</TabsTrigger>
            {isAdmin && <TabsTrigger value="permissoes"><Lock className="w-4 h-4 mr-1" />Permissões</TabsTrigger>}
          </TabsList>

          <TabsContent value="folha" forceMount className="space-y-3 data-[state=inactive]:hidden">
            <div className="flex flex-wrap gap-2 items-center">
              {!fechada && tem("lancar") && <PrepararMes comp={comp} ativos={ativosUnidade} jaPreparados={preparados} onConfirmar={prepararMes} />}
              {!fechada && tem("fechar") && linhasConf.length > 0 && <Button onClick={fecharCompetencia} disabled={!linhas.length || !!calculo.erro || rascunhos.size > 0 || ativosUnidade.some((c) => !preparados.has(c.id))}>Fechar competência</Button>}
              {fechada && <Button variant="outline" onClick={() => setAba("pagamentos")}>Ir para pagamentos e lote Clara</Button>}
              {!fechada && rascunhos.size > 0 && <p className="text-sm text-primary">{rascunhos.size} lançamento(s) com edição não salva.</p>}
              {!fechada && comPendencia > 0 && <p className="text-sm text-muted-foreground">{comPendencia} colaborador(es) com pendência.</p>}
              {fechada && tem("reabrir") && !pags.some((p) => p.status === "pago") && <Button variant="outline" onClick={reabrir}>Reabrir competência</Button>}
              {fechada && <p className="text-sm text-muted-foreground self-center">Fechada em {compRow?.fechada_em ? new Date(compRow.fechada_em).toLocaleString("pt-BR") : "—"}. Regras e valores congelados.</p>}
            </div>
            {calculo.erro && <p role="alert" className="text-destructive">{calculo.erro}. Totais e fechamento ficam bloqueados até completar as Configurações.</p>}
            {linhasConf.length === 0 && <Card><CardContent className="p-6 text-muted-foreground">Nenhum colaborador nesta competência.</CardContent></Card>}
            {linhasConf.length > 0 && <TabelaConferencia linhas={linhasConf} aberta={!fechada} selecionado={selecionado} onSelecionar={(id) => setSelecionado(id === selecionado ? null : id)} rascunhos={rascunhos} />}
            {linhasConf.map(({ c, l, r, erro: e }) => (
              <div key={`${unidadeId}-${comp}-${c.id}`} className={cn(selecionado === c.id ? "" : "md:hidden")}>
                {r ? <LinhaFolha colab={c as ColabRow} lanc={l as LancRow} res={r} regras={regras} versaoCalculo={versaoMes} bloqueada={fechada || !tem("lancar")} onSalvar={salvarLanc}
                    unidadeId={unidadeId!} comp={comp} pend={pendencias(c, l, r, e, !fechada)} abertoInicial={selecionado === c.id} onRascunho={marcarRascunho} />
                  : <Card><CardContent className="p-4"><p className="font-semibold">{c.nome}</p><p className="text-sm text-destructive">{pendencias(c, l, r, e, !fechada).join(" · ")}</p></CardContent></Card>}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="pagamentos">
            <Card>
              <CardHeader><CardTitle className="text-base">Pagamentos de {comp}</CardTitle>
                <p className="text-xs text-muted-foreground">Confirmar registra o pagamento apenas internamente. Nenhum PIX ou transferência é executado.</p></CardHeader>
              <CardContent className="space-y-2">
                {fechada && unidadeId && tem("documentos") && tem("dados_pessoais") && <LoteClara comp={comp} unidadeId={unidadeId} unidadeNome={unidadeAtual?.nome || ""} onFeito={carregar} />}
                {fechada && unidadeId && tem("documentos") && tem("dados_pessoais") && <div className="flex flex-wrap gap-2"><LoteClara parcela={1} comp={comp} unidadeId={unidadeId} unidadeNome={unidadeAtual?.nome || ""} onFeito={carregar} /><LoteClara parcela={2} comp={comp} unidadeId={unidadeId} unidadeNome={unidadeAtual?.nome || ""} onFeito={carregar} /></div>}
                {!fechada && <p className="text-sm text-muted-foreground">Feche a competência para gerar os pagamentos com valores congelados.</p>}
                {pags.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
                    <div><p className="font-medium">{p.colaborador_nome || nomeColab(p.colaborador_id)}</p><p className="text-sm text-muted-foreground">{brl(p.valor)}{p.pix ? ` · PIX ${p.pix}` : ""}{p.confirmado_em ? ` · pago em ${new Date(p.confirmado_em).toLocaleString("pt-BR")}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === "pago" ? "default" : "outline"}>{p.status === "pago" ? "Pago" : "Pendente"}</Badge>
                      {p.status === "pendente" ? (tem("confirmar") && <Button size="sm" onClick={() => marcarPagamento(p, "pago")}>Confirmar pagamento</Button>)
                        : (tem("desfazer") && <Button size="sm" variant="outline" onClick={() => marcarPagamento(p, "pendente")}>Desfazer</Button>)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="painel"><PainelFolha comp={comp} unidadeAtualId={unidadeId} versao={versao} /></TabsContent>
          <TabsContent value="contracheques"><ImportarContracheques comp={comp} unidadeId={unidadeId} fechada={fechada} colabs={colabs} podeImportar={tem("importar")} podeDocumentos={tem("documentos")} podeOriginal={tem("ver") && tem("documentos") && tem("dados_pessoais")} onFeito={carregar} toast={toast} /></TabsContent>
          <TabsContent value="exportar" className="space-y-4"><ExportarFolha key={`${comp}-${unidadeId}-${versao}`} comp={comp} unidadeId={unidadeId} toast={toast} /></TabsContent>
          <TabsContent value="colaboradores"><Colaboradores podeEditar={tem("colaboradores")} podePessoais={tem("dados_pessoais")} colabs={colabs} unidadeId={unidadeId} regras={regrasAtuais} onChange={carregar} erro={erro} /></TabsContent>

          <TabsContent value="historico">
            <Card><CardContent className="p-4 space-y-2">
              {aud.length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
              {aud.map((a) => (
                <div key={a.id} className="text-sm border-b pb-2">
                  <span className="font-medium">{new Date(a.created_at).toLocaleString("pt-BR")}</span> · {a.tabela.replace("folha_", "")} · {a.acao}
                  {a.competencia ? ` · ${a.competencia}` : ""} {a.depois?.status && a.antes?.status !== a.depois?.status ? ` · ${a.antes?.status ?? "—"} → ${a.depois.status}` : ""}
                  {a.depois?.nome ? ` · ${a.depois.nome}` : ""}
                  {a.tabela === "folha_contracheques" ? ` · ${a.depois?.arquivo_nome ?? ""} · ${a.antes?.status ?? "novo"} → ${a.depois?.status ?? "—"}` : ""}
                  {a.tabela === "folha_contracheque_itens" ? ` · ${nomeColab(a.depois?.colaborador_id)} · líquido ${a.antes ? brl(a.antes.liquido) + " → " : ""}${brl(a.depois?.liquido)}${a.depois?.ativo === false ? " · desativado" : ""}${a.depois?.motivo_correcao && a.depois?.motivo_correcao !== a.antes?.motivo_correcao ? ` · motivo: ${a.depois.motivo_correcao}` : ""}` : ""}
                  {a.tabela === "folha_lancamentos" && a.antes && a.antes.liquido_importado !== a.depois?.liquido_importado ? ` · ${nomeColab(a.depois?.colaborador_id)} · contracheque ${a.antes.liquido_importado == null ? "vazio" : brl(a.antes.liquido_importado)} → ${a.depois?.liquido_importado == null ? "vazio (cálculo normal)" : brl(a.depois.liquido_importado)}` : ""}
                  {a.tabela === "folha_lancamentos" && a.antes?.dados?.comissao_manual !== a.depois?.dados?.comissao_manual ? ` · comissão manual ${brl(a.antes?.dados?.comissao_manual ?? 0)} → ${brl(a.depois?.dados?.comissao_manual ?? 0)}` : ""}
                  {a.tabela === "folha_pagamentos" && a.depois?.motivo_desfazer && a.antes?.status === "pago" && a.depois?.status === "pendente" ? ` · motivo: ${a.depois.motivo_desfazer}` : ""}
                  {a.acao === "EXPORT_CLARA" ? ` · ${a.depois?.quantidade} pagamentos · ${brl(a.depois?.total)}${a.depois?.reexportacao ? " · reexportação" : ""} · usuário ${a.user_id}` : ""}
                  {a.acao === "EXPORT_AJUDA_CLARA" ? ` · ajuda parcela ${a.depois?.parcela} · ${a.depois?.quantidade} destinatários · ${brl(a.depois?.total)}${a.depois?.reexportacao ? " · reexportação" : ""} · usuário ${a.user_id}` : ""}
                </div>
              ))}
            </CardContent></Card>
          </TabsContent>

          {isAdmin && <TabsContent value="permissoes"><Permissoes erro={erro} /></TabsContent>}
          <TabsContent value="config" className="space-y-4"><Configuracoes regras={regrasAtuais} podeEditar={tem("regras")} onSalvo={carregar} erro={erro} /></TabsContent>
        </Tabs>
      </div>
      <Dialog open={!!desfazer} onOpenChange={(v) => !v && setDesfazer(null)}>
        <DialogContent><DialogHeader><DialogTitle>Desfazer pagamento</DialogTitle></DialogHeader>
          <Label htmlFor="motivo-desfazer">Motivo</Label><Input id="motivo-desfazer" value={motivo} onChange={(e) => setMotivo(e.target.value.toUpperCase())} />
          <DialogFooter><Button disabled={motivo.trim().length < 5} onClick={async () => { if (!desfazer) return; const r = await operar({ acao: "desfazer", pagamento_id: desfazer.id, motivo }, "Pagamento desfeito internamente na folha"); if (r) setDesfazer(null); }}>Desfazer pagamento</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function CampoNum({ label, value, onChange, disabled, vazio }: { label: string; value: number | undefined | null; onChange: (n: any) => void; disabled?: boolean; vazio?: boolean }) {
  const id = useId();
  return <div><Label htmlFor={id} className="text-xs">{label}</Label><Input id={id} type="number" inputMode="decimal" min={0} step="any" disabled={disabled} defaultValue={vazio ? (value ?? "") : (value ?? "")} onBlur={(e) => onChange(vazio && e.target.value.trim() === "" ? undefined : num(e.target.value))} /></div>;
}

function CamposTurno({ t, set, est, disabled, historico }: { t: LancTurno; set: (p: Partial<LancTurno>) => void; est: boolean; disabled: boolean; historico?: boolean }) {
  const h = t.health || {};
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {est && <CampoNum label="Diárias (qtd)" value={t.d} onChange={(d) => set({ d })} disabled={disabled} />}
      {est && historico && <CampoNum label="Diárias FDS (qtd)" value={t.df} onChange={(df) => set({ df })} disabled={disabled} />}
      {est && <CampoNum label="Diárias normais (qtd)" value={t.dn} onChange={(dn) => set({ dn })} disabled={disabled} />}
      {historico && <CampoNum label="Fins de semana históricos (qtd)" value={t.f} onChange={(f) => set({ f })} disabled={disabled} />}
      <CampoNum label="Feriados/outros (qtd)" value={t.h} onChange={(hh) => set({ h: hh })} disabled={disabled} />
      <div className="col-span-2"><Label className="text-xs">Experimentais — alunos por aula (ex.: 3, 5)</Label>
        <Input disabled={disabled} defaultValue={(t.x || []).join(", ")} onBlur={(e) => set({ x: e.target.value.split(/[,;\s]+/).filter(Boolean).map((n) => Math.floor(num(n))) })} /></div>
      <div className="col-span-2 md:col-span-4 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><Switch disabled={disabled} checked={!!h.blue} onCheckedChange={(v) => set({ health: { ...h, blue: v } })} />Blue Protect (−50)</label>
        <label className="flex items-center gap-2"><Switch disabled={disabled} checked={!!h.ultra} onCheckedChange={(v) => set({ health: { ...h, ultra: v } })} />Ultra Blue (−80)</label>
        <label className="flex items-center gap-2"><Switch disabled={disabled} checked={!!h.dental} onCheckedChange={(v) => set({ health: { ...h, dental: v } })} />Dental (−12/pessoa)</label>
        <div className="w-28"><CampoNum label="Pessoas dental" value={h.quantity} onChange={(q) => set({ health: { ...h, quantity: q } })} disabled={disabled} /></div>
      </div>
    </div>
  );
}

function LinhaFolha({ colab, lanc, res, regras, versaoCalculo, bloqueada, onSalvar, unidadeId, comp, pend, abertoInicial, onRascunho }: { colab: ColabRow; lanc?: LancRow; res: ReturnType<typeof calcularFolha>; regras: RegrasFolha; versaoCalculo: string; bloqueada: boolean; onSalvar: (c: ColabRow, d: Lancamento, liq: number | null) => Promise<boolean>; unidadeId: string; comp: string; pend: string[]; abertoInicial: boolean; onRascunho: (id: string, tem: boolean) => void }) {
  const [aberto, setAberto] = useState(abertoInicial);
  useEffect(() => { if (abertoInicial) setAberto(true); }, [abertoInicial]);
  // Rascunho guardado neste navegador sobrevive à troca de mês, ano ou unidade.
  const rascunho = bloqueada ? null : lerRascunho(unidadeId, comp, colab.id);
  const [d, setD] = useState<Lancamento>(rascunho || lanc?.dados || {});
  const [liq, setLiq] = useState<number | null>(lanc?.liquido_importado ?? null);
  // Edição pendente não é sobrescrita por recargas; só sincroniza quando não há alteração local.
  const [sujo, setSujo] = useState(!!rascunho);
  useEffect(() => { onRascunho(colab.id, sujo); }, [sujo]);
  useEffect(() => { setLiq(lanc?.liquido_importado ?? null); if (!sujo) setD(lanc?.dados || {}); }, [lanc?.dados, lanc?.liquido_importado, (lanc as any)?.updated_at]);
  const editar = (n: Lancamento) => { setSujo(true); setD(n); gravarRascunho(unidadeId, comp, colab.id, n); };
  const est = colab.tipo === "ESTAGIARIO";
  let falhaPrevia: string | null = null;
  let previa = res;
  try { previa = calcularFolha(colab, { ...d, ajustes: d.ajustes?.filter((a) => a.descricao.trim()), ajuda_custo: d.ajuda_custo ? { ...d.ajuda_custo, ajustes: d.ajuda_custo.ajustes.filter(a => a.descricao.trim()) } : undefined }, regras, liq, versaoCalculo); } catch(e) { falhaPrevia=(e as Error).message; }
  const [dataFds, setDataFds] = useState("");
  const historico = !regrasExplicitas(versaoCalculo);
  const two = est && temSegundoTurno(colab);
  return (
    <Card>
      <button className="w-full text-left p-4 flex flex-wrap items-center justify-between gap-2" onClick={() => setAberto(!aberto)}>
        <div><p className="font-semibold">{colab.nome}{sujo && <Badge variant="outline" className="ml-2 border-primary text-primary">Não salvo</Badge>}</p><p className="text-xs text-muted-foreground">{est ? "Estagiário" : "CLT"}{colab.funcao ? ` · ${colab.funcao}` : ""}{colab.turno ? ` · ${colab.turno}` : ""}{res.contrachequeImportado ? " · contracheque importado" : ""}</p>{pend.length > 0 && <p className="text-xs text-destructive">{pend.join(" · ")}</p>}</div>
        <div className="text-right"><p className="font-bold">{brl(res.total)}</p>{res.desconto > 0 && <p className="text-xs text-muted-foreground">desconto {brl(res.desconto)}</p>}</div>
      </button>
      {aberto && (
        <CardContent className="space-y-3 border-t pt-4">
          {two && <p className="text-xs font-medium">1º turno</p>}
          <CamposTurno t={d} est={est} historico={historico} disabled={bloqueada} set={(p) => editar({ ...d, ...p })} />
          {two && <><p className="text-xs font-medium">2º turno</p><CamposTurno t={d.s2 || {}} est={est} historico={historico} disabled={bloqueada} set={(p) => editar({ ...d, s2: { ...(d.s2 || {}), ...p } })} /></>}
          {!historico && <section className="space-y-2"><Label>Dias de final de semana · 6 horas por dia</Label><div className="flex gap-2"><Input aria-label="Dia FDS trabalhado" type="date" disabled={bloqueada} value={dataFds} onChange={e=>setDataFds(e.target.value)} /><Button disabled={bloqueada || !dataFds} variant="outline" onClick={()=>{editar({...d, datas_fds:[...new Set([...(d.datas_fds||[]),dataFds])],f:0,df:0,s2:d.s2?{...d.s2,f:0,df:0}:undefined});setDataFds("");}}>Adicionar dia</Button></div>{(d.datas_fds||[]).map(dt=><div key={dt} className="flex gap-2 items-center text-sm"><span>{dt} · 6h</span>{!bloqueada && <Button size="sm" variant="ghost" onClick={()=>editar({...d,datas_fds:d.datas_fds?.filter(x=>x!==dt)})}>Remover dia</Button>}</div>)}</section>}
          {est && <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><Switch disabled={bloqueada} checked={d.opt?.bolsa !== false} onCheckedChange={(v) => editar({ ...d, opt: { ...d.opt, bolsa: v } })} />Bolsa no mês</label>
            <label className="flex items-center gap-2"><Switch disabled={bloqueada} checked={d.opt?.passagem !== false} onCheckedChange={(v) => editar({ ...d, opt: { ...d.opt, passagem: v } })} />Passagem no mês</label>
          </div>}
          {!est && <div className="grid grid-cols-2 gap-2 max-w-md">
            <CampoNum vazio label="Salário líquido do mês (vazio = cadastro)" value={d.salary?.net} disabled={bloqueada} onChange={(n) => editar({ ...d, salary: n === undefined ? undefined : { ...d.salary, net: n } })} />
            {liq != null && <p className="text-xs text-muted-foreground self-end">Contracheque importado: {brl(liq)} (altere pela aba Contracheques)</p>}
          </div>}
          {regrasExplicitas(versaoCalculo) && <div className="space-y-2 max-w-md"><Label>Comissão manual da competência</Label><Input aria-label="Comissão manual da competência" type="number" min={0} step="0.01" disabled={bloqueada} value={d.comissao_manual ?? 0} onChange={e => editar({ ...d, comissao_manual: num(e.target.value) })} />
            {liq != null && <p className="text-sm text-muted-foreground">Comissão informada para conferência; não somada ao líquido importado, pois pode já estar incluída.</p>}
          </div>}
          {!est && regrasExplicitas(versaoCalculo) && (d.ajuda_custo
            // Registro antigo: mantido como histórico, somente leitura. A ajuda nova tem fonte única na página Ajuda de Custo.
            ? <AjudaCusto valor={d.ajuda_custo} bloqueada total={previa.ajudaCusto?.total ?? 0} onChange={() => {}} />
            : <p className="text-sm text-muted-foreground">Ajuda de custo: preencha em <Link className="text-primary underline" to="/ajuda-custo">Financeiro → Ajuda de Custo</Link>. Ela não entra no salário.</p>)}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Adicionais e descontos identificados</h3>
            {liq != null && <p className="text-sm text-muted-foreground">Líquido importado substitui o cálculo completo. Estes ajustes não são somados novamente.</p>}
            {(d.ajustes || []).map((a) => <div key={a.id} className="grid grid-cols-2 sm:grid-cols-[1fr_140px_120px_auto] gap-2">
              <Input aria-label="Descrição do ajuste" disabled={bloqueada} value={a.descricao} onChange={(e) => editar({ ...d, ajustes: d.ajustes?.map((x) => x.id === a.id ? { ...x, descricao: e.target.value.toUpperCase() } : x) })} />
              <Select disabled={bloqueada} value={a.tipo} onValueChange={(v) => editar({ ...d, ajustes: d.ajustes?.map((x) => x.id === a.id ? { ...x, tipo: v as "adicional" | "desconto" } : x) })}><SelectTrigger aria-label="Tipo do ajuste"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="adicional">Adicional</SelectItem><SelectItem value="desconto">Desconto</SelectItem></SelectContent></Select>
              <Input aria-label="Valor do ajuste" type="number" min={0} step="0.01" disabled={bloqueada} value={a.valor} onChange={(e) => editar({ ...d, ajustes: d.ajustes?.map((x) => x.id === a.id ? { ...x, valor: num(e.target.value) } : x) })} />
              {!bloqueada && <Button variant="outline" onClick={() => editar({ ...d, ajustes: d.ajustes?.filter((x) => x.id !== a.id) })}>Remover</Button>}
            </div>)}
            {!bloqueada && <Button variant="outline" onClick={() => editar({ ...d, ajustes: [...(d.ajustes || []), { id: crypto.randomUUID(), descricao: "", tipo: "adicional", valor: 0 }] })}>Adicionar ajuste</Button>}
          </div>
          {falhaPrevia ? <p role="alert" className="text-destructive">{falhaPrevia}</p> : <div className="text-sm grid grid-cols-2 md:grid-cols-4 gap-1 bg-muted/40 rounded-md p-3">
            <span>Base: {brl(previa.base)}</span><span>Passagem: {brl(previa.passagem)}</span><span>Líder: {brl(previa.lider)}</span><span>Comissão: {brl(previa.comissao)}</span>
            <span>Diárias: {brl(previa.valores.d + previa.valores.df + previa.valores.dn)}</span><span>Fins de semana: {brl(previa.valores.f)}</span><span>Feriados: {brl(previa.valores.h)}</span><span>Experimentais: {brl(previa.valores.x)}</span>
            <span>Bruto: {brl(previa.bruto)}</span><span>Descontos: {brl(previa.desconto)}</span><span className="font-bold">Total: {brl(previa.total)}</span>
          </div>}
          {!bloqueada && <Button onClick={async () => { if (await onSalvar(colab, d, liq)) { setSujo(false); gravarRascunho(unidadeId, comp, colab.id, null); } }}>Salvar lançamento</Button>}
        </CardContent>
      )}
    </Card>
  );
}

const vazio = { nome: "", cpf: "", tipo: "ESTAGIARIO", funcao: "", turno: "", turno2: "", base: "", passagem: "", lider: false, lider_valor: "", funcao_remuneratoria: "", valor_fds: "", valor_feriado: "", pix: "" };

function Colaboradores({ podeEditar, podePessoais, colabs, unidadeId, regras, onChange, erro }: { podeEditar: boolean; podePessoais: boolean; colabs: ColabRow[]; unidadeId?: string; regras: RegrasFolha; onChange: () => void; erro: (e: any) => void }) {
  const [edit, setEdit] = useState<any | null>(null);
  const [busca, setBusca] = useState("");
  const [excluir, setExcluir] = useState<ColabRow | null>(null);
  const { toast } = useToast();
  const lista = colabs.filter((c) => !busca || c.nome.includes(busca.toUpperCase()) || (c.cpf || "").includes(busca));
  async function salvar() {
    const n = (v: any) => (v === "" || v == null ? null : num(String(v)));
    const row = {
      nome: String(edit.nome).toUpperCase().trim(), tipo: edit.tipo,
      funcao: edit.funcao ? String(edit.funcao).toUpperCase() : null, funcao_remuneratoria: edit.tipo === "CLT" && edit.funcao_remuneratoria ? edit.funcao_remuneratoria : null, turno: edit.turno || null, turno2: edit.turno2 || null,
      base: n(edit.base) ?? 0, passagem: n(edit.passagem) ?? 0, lider: !!edit.lider, lider_valor: n(edit.lider_valor),
      valor_fds: n(edit.valor_fds), valor_feriado: n(edit.valor_feriado),
      ...(podePessoais ? { cpf: edit.cpf || null, ...((edit.pix || null) !== (edit._pixOriginal ?? null) ? { pix: edit.pix ? String(edit.pix).trim() : null, pix_tipo: edit.pix ? edit.pix_tipo || null : null } : {}) } : {}),
    };
    if (!row.nome) return erro(new Error("Informe o nome"));
    if (podePessoais && row.pix && !row.pix_tipo) return erro(new Error("Selecione o tipo da chave PIX"));
    try { await chamarFolha({ acao: "salvar_colaborador", unidade_id: unidadeId, colaborador_id: edit.id, vinculo_origem_id: edit.vinculo_origem_id, dados: row }); } catch (e) { return erro(e); }
    setEdit(null); onChange();
  }
  async function alternar(c: ColabRow) { try { await chamarFolha({ acao: "inativar_colaborador", unidade_id: unidadeId, colaborador_id: c.id }); onChange(); } catch (e) { erro(e); } }
  async function excluirVinculo() {
    if (!excluir) return;
    try { await chamarFolha({ acao: "excluir_colaborador", unidade_id: unidadeId, colaborador_id: excluir.id }); toast({ title: `${excluir.nome} excluído` }); setExcluir(null); onChange(); }
    catch (e) { erro(e); }
  }
  const f = (k: string, label: string, props: any = {}) => <div><Label className="text-xs">{label}</Label><Input value={edit?.[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} {...props} /></div>;
  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex flex-wrap gap-2"><Input placeholder="BUSCAR NOME OU CPF" value={busca} onChange={(e) => setBusca(e.target.value.toUpperCase())} className="max-w-xs" />
        {podeEditar && <Button onClick={() => setEdit({ ...vazio, base: regras.bolsa, passagem: regras.passagem })}>Novo colaborador</Button>}</div>
      {lista.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
          <div><p className="font-medium">{c.nome} {!c.ativo && <Badge variant="outline">Inativo</Badge>}</p><p className="text-xs text-muted-foreground">{c.tipo === "CLT" ? "CLT" : c.tipo === "SEM_CONTRATO" ? "Sem contrato — cálculo pendente" : "Estagiário"}{c.funcao ? ` · ${c.funcao}` : ""}{(c as any).funcao_remuneratoria ? ` · ${FUNCOES_REMUNERATORIAS[(c as any).funcao_remuneratoria as keyof typeof FUNCOES_REMUNERATORIAS] ?? (c as any).funcao_remuneratoria} (formado)` : ""} · base {brl(c.base)}</p><p className="text-xs text-muted-foreground">Vínculo {c.id} · Pessoa {(c as any).pessoa_id}</p></div>
          {podeEditar && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEdit({ ...c, _pixOriginal: c.pix ?? null })}>Editar</Button><Button size="sm" variant="ghost" onClick={() => alternar(c)}>{c.ativo ? "Inativar" : "Reativar"}</Button><Button size="sm" variant="ghost" onClick={() => setExcluir(c)}>Excluir</Button></div>}
        </div>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar colaborador" : "Novo colaborador"}</DialogTitle></DialogHeader>
          {edit && <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">{f("nome", "Nome", { onChange: (e: any) => setEdit({ ...edit, nome: e.target.value.toUpperCase() }) })}</div>
            <div><Label className="text-xs">Tipo</Label><Select value={edit.tipo} onValueChange={(v) => setEdit({ ...edit, tipo: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ESTAGIARIO">Estagiário</SelectItem><SelectItem value="CLT">CLT</SelectItem><SelectItem value="SEM_CONTRATO">Sem contrato (pendente)</SelectItem></SelectContent></Select></div>
            {f("funcao", "Função", { onChange: (e: any) => setEdit({ ...edit, funcao: e.target.value.toUpperCase() }) })}
            {edit.tipo === "CLT" && <div className="col-span-2"><Label className="text-xs">Função remuneratória (professor formado)</Label><Select value={edit.funcao_remuneratoria || "NENHUMA"} onValueChange={(v) => setEdit({ ...edit, funcao_remuneratoria: v === "NENHUMA" ? "" : v })}><SelectTrigger aria-label="Função remuneratória"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NENHUMA">Não é professor formado</SelectItem>{Object.entries(FUNCOES_REMUNERATORIAS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground mt-1">Classificação para pagamento, não dá acesso ao sistema.</p></div>}
            {podePessoais && <>{f("cpf", "CPF", { inputMode: "numeric" })}<div><Label className="text-xs">Tipo da chave PIX</Label><Select value={edit.pix_tipo || ""} onValueChange={(v) => setEdit({ ...edit, pix_tipo: v })}><SelectTrigger aria-label="Tipo da chave PIX"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="cnpj">CNPJ</SelectItem><SelectItem value="telefone">Telefone</SelectItem><SelectItem value="email">E-mail</SelectItem><SelectItem value="aleatoria">Chave aleatória</SelectItem></SelectContent></Select></div>
              <div className="col-span-2">{f("pix", "Chave PIX (só cadastro)", { "data-no-uppercase": true, autoCapitalize: "off", autoCorrect: "off", spellCheck: false, "aria-label": "Chave PIX" })}</div></>}
            {!edit.id && <div className="col-span-2">{f("vinculo_origem_id", "ID do vínculo existente (opcional)")}</div>}
            {f("turno", "Turno")}{f("turno2", "2º turno (estagiário)")}
            {f("base", edit.tipo === "CLT" ? "Salário líquido" : "Bolsa", { type: "number", inputMode: "decimal" })}{f("passagem", "Passagem", { type: "number", inputMode: "decimal" })}
            {edit.tipo === "CLT" && f("valor_fds", "Valor por fim de semana", { type: "number", inputMode: "decimal" })}
            {f("valor_feriado", "Valor por feriado", { type: "number", inputMode: "decimal" })}
            {edit.tipo === "ESTAGIARIO" && <label className="flex items-center gap-2 text-sm"><Switch checked={!!edit.lider} onCheckedChange={(v) => setEdit({ ...edit, lider: v })} />Líder</label>}
            {edit.tipo === "ESTAGIARIO" && edit.lider && f("lider_valor", "Adicional líder (vazio = padrão)", { type: "number", inputMode: "decimal" })}
          </div>}
          <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {excluir?.nome}</AlertDialogTitle>
            <AlertDialogDescription>Exclui o cadastro definitivamente. Só funciona quando o vínculo nunca teve folha gravada; se houver histórico, use Inativar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirVinculo}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardContent></Card>
  );
}

function Configuracoes({ regras, podeEditar, onSalvo, erro }: { regras: RegrasFolha; podeEditar: boolean; onSalvo: () => void; erro: (e: any) => void }) {
  const [r, setR] = useState(regras);
  useEffect(() => setR(regras), [regras]);
  const campos: [keyof RegrasFolha, string][] = [["diaria", "Diária (estagiário)"], ["diaria_normal", "Diária normal (estagiário)"], ["fds", "Dia FDS estagiário (6h)"], ["clt_fds_professor", "Dia FDS professor formado — Coord. de Turno/Geral (6h)"], ["lider", "Adicional líder"], ["bolsa", "Bolsa sugerida"], ["passagem", "Passagem sugerida"]];
  async function salvar() { const { error } = await db.from("folha_config").update({ regras: r, updated_at: new Date().toISOString() }).eq("id", 1); if (error) return erro(error); onSalvo(); }
  return (
    <Card><CardContent className="p-4 space-y-4">
      <p className="text-sm text-muted-foreground">Valores únicos para todas as unidades. Competências fechadas mantêm as regras do fechamento.{!podeEditar && " Você não tem permissão para alterar."}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {campos.map(([k, l]) => <div key={k}><Label className="text-xs">{l}</Label><Input type="number" inputMode="decimal" placeholder="Não configurado" disabled={!podeEditar} value={(r[k] as number) ?? ""} onChange={(e) => setR({ ...r, [k]: e.target.value === "" ? undefined : num(e.target.value) })} /></div>)}
      </div>
      <div><Label className="text-xs">Faixa das experimentais</Label>
        <Select disabled={!podeEditar} value={r.xmode} onValueChange={(v) => setR({ ...r, xmode: v as any })}><SelectTrigger className="w-72"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mes">Pelo total de alunos do mês</SelectItem><SelectItem value="aula">Pelos alunos de cada aula</SelectItem></SelectContent></Select></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {r.faixas.map((fx, i) => <div key={i}><Label className="text-xs">{fx.b == null ? `${fx.a} ou mais alunos` : `${fx.a} a ${fx.b} alunos`}</Label><Input type="number" disabled={!podeEditar} value={fx.v} onChange={(e) => setR({ ...r, faixas: r.faixas.map((x, j) => j === i ? { ...x, v: num(e.target.value) } : x) })} /></div>)}
      </div>
      {podeEditar && <Button onClick={salvar}>Salvar configurações</Button>}
    </CardContent></Card>
  );
}

const ACOES: [string, string][] = [["ver", "Ver folha e salários"], ["dados_pessoais", "Ver CPF e PIX (dados pessoais)"], ["lancar", "Lançar valores do mês"], ["colaboradores", "Alterar cadastro e salários"], ["fechar", "Fechar competência"], ["confirmar", "Confirmar pagamento"], ["desfazer", "Desfazer pagamento"], ["importar", "Importar contracheques"], ["documentos", "Baixar documentos e exportar"]];

function Permissoes({ erro }: { erro: (e: any) => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [perm, setPerm] = useState<Record<string, Set<string>>>({});
  const carregar = useCallback(async () => {
    const [{ data: lu }, { data: ps }] = await Promise.all([supabase.functions.invoke("list-users"), db.from("folha_permissoes").select("user_id, acao")]);
    setUsers(((lu as any)?.users || []).filter((u: any) => u.role === "gerente"));
    const m: Record<string, Set<string>> = {};
    (ps || []).forEach((p: any) => { (m[p.user_id] ||= new Set()).add(p.acao); });
    setPerm(m);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  async function alternar(uid: string, acao: string, on: boolean) {
    const r = on ? await db.from("folha_permissoes").insert({ user_id: uid, acao }) : await db.from("folha_permissoes").delete().eq("user_id", uid).eq("acao", acao);
    if (r.error) return erro(r.error);
    carregar();
  }
  return (
    <Card><CardContent className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground">Administradores têm todas as ações. Gerentes têm acesso à folha, CPF/PIX, documentos e Clara nas unidades vinculadas; demais ações dependem das permissões abaixo. Regras globais são exclusivas do administrador.</p>
      {users.length === 0 && <p className="text-sm text-muted-foreground">Nenhum gerente cadastrado.</p>}
      {users.map((u) => (
        <div key={u.id} className="border rounded-md p-3 space-y-2">
          <p className="font-medium">{u.name || u.email} <span className="text-xs text-muted-foreground">{u.email}</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ACOES.map(([a, l]) => <label key={a} className="flex items-center gap-2 text-sm"><Switch disabled={["ver", "dados_pessoais", "documentos"].includes(a)} checked={["ver", "dados_pessoais", "documentos"].includes(a) || !!perm[u.id]?.has(a)} onCheckedChange={(v) => alternar(u.id, a, v)} />{l}</label>)}
          </div>
        </div>
      ))}
    </CardContent></Card>
  );
}
