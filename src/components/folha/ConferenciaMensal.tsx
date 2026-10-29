import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Lock, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { dividirAjuda, type Colaborador, type Lancamento, type calcularFolha } from "@/lib/folha/motor";

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeMes = (comp: string) => { const [a, m] = comp.split("-").map(Number); return `${MESES_LONGOS[m - 1]}/${a}`; };
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ---------- Rascunhos: edições não salvas sobrevivem à troca de mês, ano ou unidade ---------- */
const chaveRascunho = (unidade: string, comp: string, colab: string) => `folha-rascunho:${unidade}:${comp}:${colab}`;
export const lerRascunho = (u: string, c: string, id: string): Lancamento | null => {
  try { const v = sessionStorage.getItem(chaveRascunho(u, c, id)); return v ? JSON.parse(v) : null; } catch { return null; }
};
export const gravarRascunho = (u: string, c: string, id: string, d: Lancamento | null) => {
  try { d ? sessionStorage.setItem(chaveRascunho(u, c, id), JSON.stringify(d)) : sessionStorage.removeItem(chaveRascunho(u, c, id)); } catch { /* armazenamento indisponível */ }
};
export const contarRascunhos = (u: string, c: string) => {
  try { const p = `folha-rascunho:${u}:${c}:`; return Object.keys(sessionStorage).filter((k) => k.startsWith(p)).length; } catch { return 0; }
};

/* ---------- Seletor de competência ---------- */
export function SeletorCompetencia({ comp, onChange, status }: { comp: string; onChange: (c: string) => void; status: "aberta" | "fechada" | "sem_folha" }) {
  const [ano, mes] = comp.split("-").map(Number);
  const ir = (a: number, m: number) => onChange(`${a}-${String(m).padStart(2, "0")}`);
  return (
    <div className="space-y-2 min-w-0 w-full">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Ano anterior" onClick={() => ir(ano - 1, mes)}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="font-semibold tabular-nums w-14 text-center" aria-live="polite">{ano}</span>
        <Button variant="outline" size="icon" aria-label="Próximo ano" onClick={() => ir(ano + 1, mes)}><ChevronRight className="w-4 h-4" /></Button>
        {status === "fechada"
          ? <Badge variant="secondary" className="gap-1 ml-2"><Lock className="w-3 h-3" />Competência fechada</Badge>
          : <Badge variant="outline" className="ml-2">{status === "aberta" ? "Competência aberta" : "Sem folha preparada"}</Badge>}
      </div>
      <div className="overflow-x-auto -mx-1 px-1 pb-1" role="tablist" aria-label="Meses">
        <div className="flex gap-1.5 w-max">
          {MESES.map((m, i) => (
            <Button key={m} role="tab" aria-selected={mes === i + 1} size="sm" variant={mes === i + 1 ? "default" : "outline"} className="w-12 shrink-0" onClick={() => ir(ano, i + 1)}>{m}</Button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Etapas do mês ---------- */
export function FluxoMes({ etapas }: { etapas: { label: string; feito: boolean; atual?: boolean }[] }) {
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Etapas da folha do mês">
      {etapas.map((e, i) => (
        <li key={e.label} className={cn("flex items-center gap-1.5", e.atual ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {e.feito ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Circle className="w-4 h-4" />}
          {i + 1}. {e.label}
        </li>
      ))}
    </ol>
  );
}

/* ---------- Pendências de cada linha ---------- */
type Res = ReturnType<typeof calcularFolha>;
export function pendencias(c: Colaborador & { pix?: string | null }, l: { dados: Lancamento } | undefined, r: Res | null, erro: string | null, aberta: boolean) {
  const p: string[] = [];
  if (aberta && !l) p.push("Mês não preparado");
  if (erro) p.push(erro.replace(/^Cálculo indisponível:\s*/, "Configuração: "));
  if (!(c as any).pix) p.push("PIX ausente");
  if (c.tipo === "CLT" && !Number(c.base) && !l?.dados?.salary?.net) p.push("Salário líquido não informado");
  if (c.tipo === "ESTAGIARIO" && !Number(c.base)) p.push("Bolsa não informada");
  const aj = l?.dados?.ajuda_custo;
  if (aj && (r?.ajudaCusto?.total ?? 0) > 0 && !(aj.datas?.[0] && aj.datas?.[1])) p.push("Datas das parcelas da ajuda");
  return p;
}

export type LinhaConferencia = { c: Colaborador & { id: string; pix?: string | null; ativo?: boolean }; l?: { dados: Lancamento; liquido_importado: number | null }; r: Res | null; erro: string | null };

/* ---------- Tabela de conferência (computador) ---------- */
export function TabelaConferencia({ linhas, aberta, selecionado, onSelecionar, rascunhos }: { linhas: LinhaConferencia[]; aberta: boolean; selecionado: string | null; onSelecionar: (id: string) => void; rascunhos: Set<string> }) {
  return (
    <div className="hidden md:block border rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr className="text-left">
            <th className="p-2">Colaborador</th><th className="p-2 text-right">Líquido / Bolsa</th><th className="p-2 text-right">Fim de semana</th>
            <th className="p-2 text-right">Adicionais</th><th className="p-2 text-right">Comissão</th><th className="p-2 text-right">Descontos</th>
            <th className="p-2 text-right">Total a receber</th><th className="p-2 text-right">Ajuda (1ª · 2ª)</th><th className="p-2">Situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ c, l, r, erro }) => {
            const est = c.tipo === "ESTAGIARIO";
            const pend = pendencias(c, l, r, erro, aberta);
            const v = r?.valores;
            const adicionais = r ? r.lider + r.extras + (v ? v.d + v.df + v.dn + v.h + v.x : 0) : 0;
            const dias = l?.dados?.datas_fds?.length ?? 0;
            const [p1, p2] = dividirAjuda(r?.ajudaCusto?.total ?? 0);
            return (
              <tr key={c.id} onClick={() => onSelecionar(c.id)} className={cn("border-t cursor-pointer hover:bg-muted/40", selecionado === c.id && "bg-primary/5")}>
                <td className="p-2"><p className="font-medium">{c.nome}</p><p className="text-xs text-muted-foreground">{est ? "Estagiário" : "CLT"}{c.funcao ? ` · ${c.funcao}` : ""}{c.ativo === false ? " · inativo" : ""}</p></td>
                <td className="p-2 text-right">{r ? brl(r.base) : "—"}<p className="text-[10px] text-muted-foreground">{est ? "bolsa" : r?.contrachequeImportado ? "líquido importado" : "salário líquido"}</p></td>
                <td className="p-2 text-right">{r ? brl(v?.f ?? 0) : "—"}<p className="text-[10px] text-muted-foreground">{dias} dia(s)</p></td>
                <td className="p-2 text-right">{r ? brl(adicionais) : "—"}</td>
                <td className="p-2 text-right">{r ? brl(r.comissao) : "—"}</td>
                <td className="p-2 text-right">{r ? brl(r.desconto) : "—"}</td>
                <td className="p-2 text-right font-bold">{r ? brl(r.total) : "—"}</td>
                <td className="p-2 text-right text-xs">{r?.ajudaCusto?.total ? `${brl(p1)} · ${brl(p2)}` : "—"}</td>
                <td className="p-2">
                  {rascunhos.has(c.id) && <Badge variant="outline" className="mr-1 border-primary text-primary">Não salvo</Badge>}
                  {pend.length ? <span className="text-xs text-destructive">{pend.join(" · ")}</span> : <Badge variant="secondary">Completo</Badge>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Preparar o mês ---------- */
export function PrepararMes({ comp, ativos, jaPreparados, onConfirmar }: { comp: string; ativos: (Colaborador & { id: string })[]; jaPreparados: Set<string>; onConfirmar: (ids: string[]) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [busy, setBusy] = useState(false);
  const faltam = ativos.filter((c) => !jaPreparados.has(c.id));
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const abrir = () => { setMarcados(new Set(faltam.map((c) => c.id))); setAberto(true); };
  if (!faltam.length) return null;
  return (
    <>
      <Button onClick={abrir} size="lg">{jaPreparados.size ? `Incluir ${faltam.length} colaborador(es) ativo(s)` : `Preparar folha de ${nomeMes(comp)}`}</Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preparar folha de {nomeMes(comp)}</DialogTitle>
            <DialogDescription>
              Cria somente os lançamentos que ainda não existem, usando os valores fixos do cadastro. Dias trabalhados, comissões, ajustes, descontos variáveis, contracheques, datas de parcelas e pagamentos do mês anterior não são copiados.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {faltam.map((c) => (
              <label key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 text-sm">
                <Checkbox checked={marcados.has(c.id)} onCheckedChange={(v) => { const n = new Set(marcados); v ? n.add(c.id) : n.delete(c.id); setMarcados(n); }} />
                <span className="flex-1">{c.nome}<span className="text-muted-foreground"> · {c.tipo === "ESTAGIARIO" ? "Estagiário · bolsa" : "CLT · salário líquido"} {Number(c.base) ? brl(Number(c.base)) : "— a preencher"}{Number(c.passagem) ? ` · passagem ${brl(Number(c.passagem))}` : ""}</span></span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Colaboradores ativos desmarcados continuam entrando no fechamento da competência aberta. Para tirá-los da folha, inative o cadastro.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={busy || !marcados.size} onClick={async () => { setBusy(true); try { await onConfirmar([...marcados]); setAberto(false); } finally { setBusy(false); } }}>Criar {marcados.size} lançamento(s)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
