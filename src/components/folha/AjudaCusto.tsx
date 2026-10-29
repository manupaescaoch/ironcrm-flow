import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dividirAjuda, type Lancamento } from "@/lib/folha/motor";

export function AjudaCusto({ valor, onChange, bloqueada, total }: { valor: Lancamento["ajuda_custo"]; onChange: (v: NonNullable<Lancamento["ajuda_custo"]>) => void; bloqueada: boolean; total: number }) {
  const ajuda = valor ?? { passagem: 0, alimentacao: 0, ajustes: [] };
  const numero = (v: string) => Math.max(0, Number(v) || 0);
  return <section className="space-y-2 border-t pt-3">
    <h3 className="text-sm font-medium">Ajuda de custo CLT · separada do líquido</h3>
    <div className="grid grid-cols-2 gap-2">
      <div><Label htmlFor="ajuda-passagem">Passagem da competência</Label><Input aria-label="Passagem da ajuda de custo" type="number" min={0} step="0.01" disabled={bloqueada} value={ajuda.passagem} onChange={e => onChange({ ...ajuda, passagem: numero(e.target.value) })} /></div>
      <div><Label>Alimentação da competência</Label><Input aria-label="Alimentação da ajuda de custo" type="number" min={0} step="0.01" disabled={bloqueada} value={ajuda.alimentacao} onChange={e => onChange({ ...ajuda, alimentacao: numero(e.target.value) })} /></div>
    </div>
    {ajuda.ajustes.map(a => <div key={a.id} className="grid grid-cols-2 sm:grid-cols-[1fr_140px_120px_auto] gap-2">
      <Input aria-label="Descrição do ajuste da ajuda" disabled={bloqueada} value={a.descricao} onChange={e => onChange({ ...ajuda, ajustes: ajuda.ajustes.map(x => x.id === a.id ? { ...x, descricao: e.target.value.toUpperCase() } : x) })} />
      <Select disabled={bloqueada} value={a.tipo} onValueChange={v => onChange({ ...ajuda, ajustes: ajuda.ajustes.map(x => x.id === a.id ? { ...x, tipo: v as "adicional" | "desconto" } : x) })}><SelectTrigger aria-label="Tipo do ajuste da ajuda"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="adicional">Adicional</SelectItem><SelectItem value="desconto">Desconto</SelectItem></SelectContent></Select>
      <Input aria-label="Valor do ajuste da ajuda" disabled={bloqueada} type="number" min={0} step="0.01" value={a.valor} onChange={e => onChange({ ...ajuda, ajustes: ajuda.ajustes.map(x => x.id === a.id ? { ...x, valor: numero(e.target.value) } : x) })} />
      {!bloqueada && <Button variant="outline" onClick={() => onChange({ ...ajuda, ajustes: ajuda.ajustes.filter(x => x.id !== a.id) })}>Remover</Button>}
    </div>)}
    {!bloqueada && <Button variant="outline" onClick={() => onChange({ ...ajuda, ajustes: [...ajuda.ajustes, { id: crypto.randomUUID(), descricao: "", tipo: "adicional", valor: 0 }] })}>Adicionar ajuste da ajuda</Button>}
    <p className="text-sm font-medium">Ajuda de custo: {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
    <div className="grid grid-cols-2 gap-2">{([0,1] as const).map(i => <div key={i}><Label>{i+1}ª parcela · {dividirAjuda(total)[i].toLocaleString("pt-BR", {style:"currency",currency:"BRL"})}</Label><Input aria-label={`Data da parcela ${i+1}`} type="date" disabled={bloqueada} value={ajuda.datas?.[i] || ""} onChange={e => { const datas: [string,string] = [...(ajuda.datas ?? ["",""])]; datas[i]=e.target.value; onChange({...ajuda,datas}); }} /></div>)}</div>
    <p className="text-sm text-muted-foreground">Duas parcelas separadas do salário. Datas obrigatórias para exportar o lote Clara específico da parcela.</p>
  </section>;
}