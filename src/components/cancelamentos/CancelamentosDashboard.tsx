import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Row = any;
interface Props {
  data: Row[];
  unidades: { id: string; nome: string }[];
  ativosPorUnidade: Record<string, number>;
  unidadeInicial: string;
}

const PERIODOS = [
  ['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês'], ['mes_ant', 'Mês anterior'], ['custom', 'Personalizado'],
] as const;

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;
const fmtNum = (v: number) => v.toFixed(1).replace('.', ',');
const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

function rangeFor(p: string, ini: string, fim: string): [Date, Date] {
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eod = new Date(sod.getTime() + 86400000 - 1);
  switch (p) {
    case 'hoje': return [sod, eod];
    case '7d': return [new Date(sod.getTime() - 6 * 86400000), eod];
    case '30d': return [new Date(sod.getTime() - 29 * 86400000), eod];
    case 'mes': return [new Date(now.getFullYear(), now.getMonth(), 1), eod];
    case 'mes_ant': return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, -1)];
    default: {
      const a = ini ? toDate(ini) : new Date(sod.getTime() - 29 * 86400000);
      const b = fim ? new Date(toDate(fim).getTime() + 86400000 - 1) : eod;
      return [a, b];
    }
  }
}

function contar(rows: Row[], get: (r: Row) => string[] | string | null | undefined) {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    const v = get(r);
    const arr = Array.isArray(v) ? v : v ? [v] : [];
    new Set(arr.map((x) => String(x).trim()).filter(Boolean)).forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const Vazio = () => <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período</p>;

function Barras({ itens, total, max }: { itens: [string, number][]; total: number; max?: number }) {
  if (!itens.length || !total) return <Vazio />;
  const top = itens[0][1];
  return (
    <div className="space-y-3">
      {itens.slice(0, max ?? 15).map(([k, v]) => (
        <div key={k} className="space-y-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{k}</span>
            <span className="shrink-0 font-semibold">{v} <span className="font-normal text-muted-foreground">· {fmtPct(pct(v, total))}</span></span>
          </div>
          <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct(v, top)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ titulo, valor, sub }: { titulo: string; valor: string | number; sub?: string }) {
  return (
    <Card><CardContent className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-3xl font-bold">{valor}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </CardContent></Card>
  );
}

function Secao({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const ORDEM_ACOMP = ['Sim, sempre', 'Na maioria das vezes', 'Algumas vezes', 'Raramente', 'Não'];

export function CancelamentosDashboard({ data, unidades, ativosPorUnidade, unidadeInicial }: Props) {
  const [unidade, setUnidade] = useState(unidadeInicial);
  const [periodo, setPeriodo] = useState('30d');
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');
  const [modoSerie, setModoSerie] = useState<'qtd' | 'taxa'>('qtd');

  const [inicio, final] = rangeFor(periodo, ini, fim);
  const dur = final.getTime() - inicio.getTime();
  const prevIni = new Date(inicio.getTime() - dur - 1);

  const doUnid = useMemo(() => (unidade === 'all' ? data : data.filter((r) => r.unidade_id === unidade)), [data, unidade]);
  const rows = doUnid.filter((r) => { const t = new Date(r.created_at).getTime(); return t >= inicio.getTime() && t <= final.getTime(); });
  const prev = doUnid.filter((r) => { const t = new Date(r.created_at).getTime(); return t >= prevIni.getTime() && t < inicio.getTime(); });

  const ativos = unidade === 'all' ? Object.values(ativosPorUnidade).reduce((a, b) => a + b, 0) : ativosPorUnidade[unidade] ?? 0;
  const total = rows.length;
  const notas = rows.filter((r) => r.nota != null).map((r) => r.nota as number);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const aceitaram = rows.filter((r) => r.aceita_contato_antes === true).length;
  const retidos = rows.filter((r) => r.status === 'Retido').length;
  const emContato = rows.filter((r) => r.status === 'Em contato').length;
  const andamento = rows.filter((r) => r.status === 'Retenção em andamento').length;
  const variacao = prev.length ? pct(total - prev.length, prev.length) : null;

  const motivos = contar(rows, (r) => r.motivos);
  const problemas = contar(rows, (r) => (r.problemas ?? []).filter((p: string) => p !== 'Nenhum problema específico'));
  const acomp = ORDEM_ACOMP.map((k) => [k, rows.filter((r) => r.acompanhamento === k).length] as [string, number]);
  const acompTotal = rows.filter((r) => r.acompanhamento).length;
  const poucoAcomp = pct(acomp[3][1] + acomp[4][1], acompTotal);
  const evolucao = contar(rows, (r) => r.evolucao);
  const solucoes = contar(rows, (r) => (r.solucoes_retencao ?? []).filter((s: string) => !s.startsWith('Não, minha decisão')));
  const destinoResp = contar(rows, (r) => r.vai_treinar_outro_local);
  const destinoTotal = rows.filter((r) => r.vai_treinar_outro_local).length;
  const fatores = contar(rows, (r) => r.fator_escolha);

  const destinos = useMemo(() => {
    const m = new Map<string, { n: number; f: Map<string, number> }>();
    rows.forEach((r) => {
      const d = (r.proxima_escolha ?? '').trim().toUpperCase();
      if (!d || d === '-' || d.length < 2) return;
      const e = m.get(d) ?? { n: 0, f: new Map() };
      e.n++;
      if (r.fator_escolha) e.f.set(r.fator_escolha, (e.f.get(r.fator_escolha) ?? 0) + 1);
      m.set(d, e);
    });
    return [...m.entries()].map(([d, e]) => [d, e.n, [...e.f.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'] as [string, number, string]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [rows]);

  const dist = [
    ['9–10', notas.filter((n) => n >= 9).length],
    ['7–8', notas.filter((n) => n >= 7 && n <= 8).length],
    ['0–6', notas.filter((n) => n <= 6).length],
  ] as [string, number][];

  const serie = useMemo(() => {
    const dias = dur / 86400000;
    const porMes = dias > 62;
    const porSemana = !porMes && dias > 31;
    const buckets = new Map<string, number>();
    const cur = new Date(inicio);
    const key = (d: Date) => {
      if (porMes) return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      if (porSemana) { const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()); return `${String(s.getDate()).padStart(2, '0')}/${String(s.getMonth() + 1).padStart(2, '0')}`; }
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    while (cur <= final) { buckets.set(key(cur), 0); cur.setDate(cur.getDate() + 1); }
    rows.forEach((r) => { const k = key(new Date(r.created_at)); buckets.set(k, (buckets.get(k) ?? 0) + 1); });
    return [...buckets.entries()].map(([k, v]) => ({ k, qtd: v, taxa: ativos ? Number(pct(v, ativos).toFixed(2)) : 0 }));
  }, [rows, inicio.getTime(), final.getTime(), ativos]);

  const comparativo = unidades.map((u) => {
    const r = data.filter((x) => x.unidade_id === u.id && new Date(x.created_at) >= inicio && new Date(x.created_at) <= final);
    const n = r.filter((x) => x.nota != null);
    const at = ativosPorUnidade[u.id] ?? 0;
    return { nome: u.nome, sol: r.length, at, taxa: at ? pct(r.length, at) : null, media: n.length ? n.reduce((a, b) => a + b.nota, 0) / n.length : null, ace: r.filter((x) => x.aceita_contato_antes).length, ret: r.filter((x) => x.status === 'Retido').length };
  });

  const nomeUnid = unidade === 'all' ? '' : ` da ${unidades.find((u) => u.id === unidade)?.nome ?? ''}`;
  const pontos: string[] = [];
  if (total) {
    if (motivos[0]) pontos.push(`${fmtPct(pct(motivos[0][1], total))} dos cancelamentos${nomeUnid} citaram ${motivos[0][0].toLowerCase()}.`);
    if (motivos[1]) pontos.push(`${motivos[1][0]} apareceu em ${fmtPct(pct(motivos[1][1], total))} dos cancelamentos${nomeUnid}.`);
    if (acompTotal) pontos.push(`${fmtPct(poucoAcomp)} dos alunos que solicitaram cancelamento relataram pouco ou nenhum acompanhamento.`);
    if (problemas[0]) pontos.push(`O problema mais relatado foi ${problemas[0][0].toLowerCase()} (${problemas[0][1]} ${problemas[0][1] === 1 ? 'aluno' : 'alunos'}).`);
    if (dist[2][1]) pontos.push(`${dist[2][1]} ${dist[2][1] === 1 ? 'aluno avaliou' : 'alunos avaliaram'} a experiência com nota de 0 a 6.`);
    pontos.push(`${aceitaram} ${aceitaram === 1 ? 'aluno autorizou' : 'alunos autorizaram'} contato para retenção.`);
    if (retidos) pontos.push(`${retidos} ${retidos === 1 ? 'oportunidade foi convertida' : 'oportunidades foram convertidas'} em retenção.`);
    if (variacao != null) pontos.push(`Os cancelamentos ${variacao >= 0 ? 'aumentaram' : 'diminuíram'} ${fmtPct(Math.abs(variacao))} em relação ao período anterior.`);
    if (unidade === 'all') {
      const c = comparativo.filter((x) => x.taxa != null && x.sol > 0).sort((a, b) => (b.taxa! - a.taxa!))[0];
      if (c) pontos.push(`${c.nome} tem a maior taxa de cancelamento do período: ${fmtPct(c.taxa!)}.`);
    }
  }

  return (
    <div className="space-y-6">
      <Card><CardContent className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">Unidade</p>
          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">Período</p>
          <div className="flex flex-wrap gap-1">
            {PERIODOS.map(([k, l]) => (
              <Button key={k} size="sm" variant={periodo === k ? 'default' : 'outline'} onClick={() => setPeriodo(k)}>{l}</Button>
            ))}
          </div>
        </div>
        {periodo === 'custom' && (
          <div className="flex gap-2">
            <Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="w-40" />
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-40" />
          </div>
        )}
      </CardContent></Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi titulo="Solicitações" valor={total} sub={variacao != null ? `${variacao >= 0 ? '+' : ''}${fmtPct(variacao)} vs. período anterior (${prev.length})` : undefined} />
        <Kpi titulo="Taxa de cancelamento" valor={ativos ? fmtPct(pct(total, ativos)) : '—'} sub={ativos ? `${total} solicitações / ${ativos} alunos ativos` : 'Alunos ativos não cadastrados'} />
        <Kpi titulo="Nota média" valor={media != null ? fmtNum(media) : '—'} sub={notas.length ? `${notas.length} avaliações` : undefined} />
        <Kpi titulo="Oportunidades de retenção" valor={aceitaram} sub={total ? `${fmtPct(pct(aceitaram, total))} das solicitações` : undefined} />
        <Kpi titulo="Retidos" valor={retidos} sub={aceitaram ? `${fmtPct(pct(retidos, aceitaram))} das oportunidades` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Secao titulo="Principais motivos de cancelamento" className="lg:col-span-2"><Barras itens={motivos} total={total} /></Secao>
        <Secao titulo="Experiência dos alunos">
          {notas.length ? (
            <div className="space-y-5">
              <div><p className="text-xs uppercase text-muted-foreground">Nota média</p><p className="text-4xl font-bold">{fmtNum(media!)} <span className="text-lg font-normal text-muted-foreground">/ 10</span></p></div>
              <Barras itens={dist} total={notas.length} />
            </div>
          ) : <Vazio />}
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Secao titulo="Principais problemas relatados"><Barras itens={problemas} total={total} /></Secao>
        <Secao titulo="Percepção de acompanhamento">
          {acompTotal ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3"><p className="text-xs uppercase text-muted-foreground">Pouco ou nenhum acompanhamento</p><p className="text-2xl font-bold">{fmtPct(poucoAcomp)}</p></div>
              <Barras itens={acomp.filter((a) => a[1] > 0)} total={acompTotal} />
            </div>
          ) : <Vazio />}
        </Secao>
        <Secao titulo="Percepção de evolução"><Barras itens={evolucao} total={rows.filter((r) => r.evolucao).length} /></Secao>
      </div>

      <Secao titulo="Retenção">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[['Aceitaram contato', aceitaram], ['Em contato', emContato], ['Retenção em andamento', andamento], ['Retidos', retidos], ['Taxa de retenção', aceitaram ? fmtPct(pct(retidos, aceitaram)) : '—']].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></div>
          ))}
        </div>
        <p className="mb-3 mt-6 text-sm font-semibold uppercase">O que poderia fazer o aluno ficar?</p>
        <Barras itens={solucoes} total={total} />
      </Secao>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Secao titulo="Para onde os alunos estão indo?">
          {destinoTotal ? <Barras itens={destinoResp} total={destinoTotal} /> : <Vazio />}
          <p className="mb-2 mt-6 text-sm font-semibold uppercase">Destinos mais citados</p>
          {destinos.length ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Destino</th><th>Qtd.</th><th>Principal fator</th></tr></thead>
              <tbody>{destinos.map(([d, n, f]) => <tr key={d} className="border-b last:border-0"><td className="py-2 pr-2">{d}</td><td>{n}</td><td>{f}</td></tr>)}</tbody>
            </table>
          ) : <Vazio />}
        </Secao>
        <Secao titulo="Por que escolheram outra solução?"><Barras itens={fatores} total={rows.filter((r) => r.fator_escolha).length} /></Secao>
      </div>

      {unidade === 'all' && (
        <Secao titulo="Comparativo por unidade">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Unidade</th><th>Solicitações</th><th>Alunos ativos</th><th>Taxa de cancelamento</th><th>Nota média</th><th>Aceitaram retenção</th><th>Retidos</th>
              </tr></thead>
              <tbody>{comparativo.map((c) => (
                <tr key={c.nome} className="border-b last:border-0">
                  <td className="py-2 font-medium">{c.nome}</td><td>{c.sol}</td><td>{c.at || '—'}</td>
                  <td className="font-semibold">{c.taxa != null ? fmtPct(c.taxa) : '—'}</td>
                  <td>{c.media != null ? fmtNum(c.media) : '—'}</td><td>{c.ace}</td><td>{c.ret}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Secao>
      )}

      <Secao titulo="Cancelamentos ao longo do tempo">
        <div className="mb-3 flex gap-1">
          <Button size="sm" variant={modoSerie === 'qtd' ? 'default' : 'outline'} onClick={() => setModoSerie('qtd')}>Quantidade</Button>
          <Button size="sm" variant={modoSerie === 'taxa' ? 'default' : 'outline'} onClick={() => setModoSerie('taxa')} disabled={!ativos}>Taxa de cancelamento</Button>
        </div>
        {total ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="k" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={modoSerie === 'taxa'} />
                <Tooltip formatter={(v: number) => (modoSerie === 'taxa' ? `${v}%` : v)} />
                <Line type="monotone" dataKey={modoSerie} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name={modoSerie === 'qtd' ? 'Solicitações' : 'Taxa'} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <Vazio />}
      </Secao>

      <Secao titulo="Pontos de atenção">
        {pontos.length ? (
          <ul className="space-y-2">{pontos.map((p) => (
            <li key={p} className={cn('flex gap-2 text-sm')}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{p}</li>
          ))}</ul>
        ) : <Vazio />}
      </Secao>
    </div>
  );
}
