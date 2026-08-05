import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  AtendimentoRow,
  CoordenadorRow,
  HorarioRow,
  PendenciaTracking,
  TurnoRow,
  TURNOS,
  calcularDistribuicao,
  calcularIndice,
  dateFromTimestamp,
  derivarPendencias,
  eachDate,
  isoDate,
  mediaNotas,
  mesclarTracking,
  previousRange,
  variacao,
} from '@/lib/operacionalDashboard';

export interface OperacionalFiltros {
  unidade: string; // 'all' | 'ZONA NORTE' | ...
  turno: string; // 'all' | 'MANHÃ' ...
  funcao: string; // 'all' | 'coordenador' | 'horario' | 'turno'
  funcionario: string; // 'all' | nome
  start: string;
  end: string;
}

interface RawData {
  horario: HorarioRow[];
  coordenador: CoordenadorRow[];
  turno: TurnoRow[];
  atendimentos: AtendimentoRow[];
  tracking: PendenciaTracking[];
}

function useRawOperacional(start: string, end: string) {
  const { start: prevStart } = previousRange(start, end);
  return useQuery<RawData>({
    queryKey: ['operacional-dashboard-raw', prevStart, end],
    queryFn: async () => {
      const fromTs = `${prevStart}T00:00:00`;
      const toTs = `${end}T23:59:59.999`;
      const [h, c, t, a, p] = await Promise.all([
        supabase.from('encerramento_horario_respostas').select('*').gte('data', prevStart).lte('data', end),
        supabase.from('encerramento_coordenador_respostas').select('*').gte('created_at', fromTs).lte('created_at', toTs),
        supabase.from('encerramento_turno_respostas').select('*').gte('created_at', fromTs).lte('created_at', toTs),
        supabase.from('v_operacional_atendimentos').select('*').gte('data', prevStart).lte('data', end),
        supabase.from('operacional_pendencias').select('*'),
      ]);
      const err = h.error || c.error || t.error || a.error || p.error;
      if (err) throw err;
      return {
        horario: (h.data ?? []) as HorarioRow[],
        coordenador: (c.data ?? []) as CoordenadorRow[],
        turno: (t.data ?? []) as TurnoRow[],
        atendimentos: (a.data ?? []) as AtendimentoRow[],
        tracking: (p.data ?? []) as PendenciaTracking[],
      };
    },
    staleTime: 60_000,
  });
}

const inRange = (d: string, start: string, end: string) => d >= start && d <= end;

export interface QualidadeKPI {
  key: string;
  label: string;
  media: number | null;
  mediaAnterior: number | null;
  avaliacoes: number;
  abaixoDe4: number;
  registros: {
    nota: number;
    unidade: string;
    turno: string | null;
    nome: string | null;
    created_at: string;
    tabela: string;
    id: string;
  }[];
}

export function useOperacionalDashboard(filtros: OperacionalFiltros) {
  const { data, isLoading, error, refetch } = useRawOperacional(filtros.start, filtros.end);
  const prev = previousRange(filtros.start, filtros.end);

  const result = useMemo(() => {
    const empty = {
      unidadesDisponiveis: [] as string[],
      funcionariosDisponiveis: [] as string[],
    };
    if (!data) return null;

    const matchUnidade = (u: string) => filtros.unidade === 'all' || u === filtros.unidade;
    const matchTurno = (t: string | null) => filtros.turno === 'all' || t === filtros.turno;
    const matchFuncao = (f: string) => filtros.funcao === 'all' || filtros.funcao === f;
    const matchFuncionario = (nomes: (string | null)[]) =>
      filtros.funcionario === 'all' || nomes.some((n) => (n ?? '').toUpperCase() === filtros.funcionario.toUpperCase());

    /* ------------------------------- Slices -------------------------------- */
    const slice = (start: string, end: string) => {
      const horario = data.horario.filter(
        (r) => inRange(r.data, start, end) && matchUnidade(r.unidade) && matchTurno(r.turno) && matchFuncao('horario') && matchFuncionario([r.nome]),
      );
      const coordenador = data.coordenador.filter((r) => {
        const d = dateFromTimestamp(r.created_at);
        return inRange(d, start, end) && matchUnidade(r.unidade) && matchTurno(r.turno) && matchFuncao('coordenador') && matchFuncionario([r.nome]);
      });
      const turno = data.turno.filter((r) => {
        const d = dateFromTimestamp(r.created_at);
        return inRange(d, start, end) && matchUnidade(r.unidade) && matchTurno(r.turno) && matchFuncao('turno') && matchFuncionario([r.nome]);
      });
      const atendimentos = data.atendimentos.filter(
        (r) =>
          inRange(r.data, start, end) &&
          matchUnidade(r.unidade) &&
          matchTurno(r.turno) &&
          matchFuncao('horario') &&
          matchFuncionario([r.treinador, r.responsavel]),
      );
      return { horario, coordenador, turno, atendimentos };
    };

    const atual = slice(filtros.start, filtros.end);
    const anterior = slice(prev.start, prev.end);

    /* --------------------------- Produtividade ----------------------------- */
    const somaAtendimentos = (rows: AtendimentoRow[]) =>
      rows.reduce((acc, r) => acc + (r.quantidade && r.quantidade > 0 ? r.quantidade : 0), 0);
    const treinadoresAtivos = (rows: AtendimentoRow[]) =>
      new Set(rows.filter((r) => r.treinador && (r.quantidade ?? 0) > 0).map((r) => r.treinador as string));

    const totalAtendimentos = somaAtendimentos(atual.atendimentos);
    const totalAtendimentosAnt = somaAtendimentos(anterior.atendimentos);
    const ativos = treinadoresAtivos(atual.atendimentos);
    const ativosAnt = treinadoresAtivos(anterior.atendimentos);
    const mediaTreinador = ativos.size ? totalAtendimentos / ativos.size : null;
    const mediaTreinadorAnt = ativosAnt.size ? totalAtendimentosAnt / ativosAnt.size : null;
    const pendentesRevisao = atual.atendimentos.filter((r) => r.pendente_revisao).length;

    const experimentais = (s: typeof atual) =>
      s.horario.reduce((a, r) => a + (r.experimentais_realizadas ?? 0), 0) +
      s.turno.reduce((a, r) => a + (r.experimentais_realizadas ?? 0), 0);

    /* ---------------------- Taxa de preenchimento / turnos ------------------ */
    const unidadesBase =
      filtros.unidade !== 'all'
        ? [filtros.unidade]
        : [...new Set([...data.horario, ...data.coordenador, ...data.turno].map((r) => r.unidade))].sort();
    const turnosBase = filtros.turno !== 'all' ? [filtros.turno] : [...TURNOS];

    const combosPrevistos = (start: string, end: string) => {
      const dias = eachDate(start, end);
      const out: { unidade: string; data: string; turno: string }[] = [];
      dias.forEach((d) => unidadesBase.forEach((u) => turnosBase.forEach((t) => out.push({ unidade: u, data: d, turno: t }))));
      return out;
    };
    const combosPreenchidos = (s: typeof atual) => {
      const set = new Set<string>();
      s.horario.forEach((r) => set.add(`${r.unidade}|${r.data}|${r.turno}`));
      s.turno.forEach((r) => set.add(`${r.unidade}|${dateFromTimestamp(r.created_at)}|${r.turno}`));
      s.coordenador.forEach((r) => set.add(`${r.unidade}|${dateFromTimestamp(r.created_at)}|${r.turno}`));
      return set;
    };

    const previstos = combosPrevistos(filtros.start, filtros.end);
    const preenchidos = combosPreenchidos(atual);
    const previstosAnt = combosPrevistos(prev.start, prev.end);
    const preenchidosAnt = combosPreenchidos(anterior);
    const hoje = isoDate(new Date());
    const faltantes = previstos.filter((c) => c.data < hoje && !preenchidos.has(`${c.unidade}|${c.data}|${c.turno}`));

    const taxaPreenchimento = previstos.length ? (preenchidos.size / previstos.length) * 100 : null;
    const taxaPreenchimentoAnt = previstosAnt.length ? (preenchidosAnt.size / previstosAnt.length) * 100 : null;

    /* --------------------------- Qualidade (1-5) --------------------------- */
    type QualRow = { nota: number | null; unidade: string; turno: string | null; nome: string | null; created_at: string; tabela: string; id: string };
    const coordRows = (s: typeof atual, pick: (r: (typeof atual)['coordenador'][number]) => number | null): QualRow[] =>
      s.coordenador.map((r) => ({
        nota: pick(r),
        unidade: r.unidade,
        turno: (r as { turno?: string | null }).turno ?? null,
        nome: r.nome,
        created_at: r.created_at,
        tabela: 'encerramento_coordenador_respostas',
        id: r.id,
      }));

    const qualDefs: { key: string; label: string; rows: (s: typeof atual) => QualRow[] }[] = [
      { key: 'limpeza', label: 'Limpeza', rows: (s) => coordRows(s, (r) => r.limpeza_geral) },
      { key: 'organizacao', label: 'Organização do espaço', rows: (s) => coordRows(s, (r) => r.organizacao_espaco) },
      { key: 'climatizacao', label: 'Climatização', rows: (s) => coordRows(s, (r) => r.climatizacao) },
      { key: 'equipamentos', label: 'Equipamentos funcionando', rows: (s) => coordRows(s, (r) => r.equipamentos_funcionando) },
      { key: 'infraestrutura', label: 'Infraestrutura', rows: (s) => coordRows(s, (r) => r.infraestrutura) },
      { key: 'postura', label: 'Postura no atendimento', rows: (s) => coordRows(s, (r) => r.postura_atendimento) },
      { key: 'proatividade', label: 'Proatividade', rows: (s) => coordRows(s, (r) => r.proatividade) },
      {
        key: 'clima',
        label: 'Clima da equipe',
        rows: (s) =>
          s.turno.map((r) => ({
            nota: r.clima_equipe,
            unidade: r.unidade,
            turno: (r as { turno?: string | null }).turno ?? null,
            nome: r.nome,
            created_at: r.created_at,
            tabela: 'encerramento_turno_respostas',
            id: r.id,
          })),
      },
      {
        key: 'nota_geral',
        label: 'Nota geral do turno',
        rows: (s) => [
          ...coordRows(s, (r) => r.nota_geral),
          ...s.horario.map((r) => ({
            nota: r.nota_geral,
            unidade: r.unidade,
            turno: (r as { turno?: string | null }).turno ?? null,
            nome: r.nome,
            created_at: r.created_at,
            tabela: 'encerramento_horario_respostas',
            id: r.id,
          })),
        ],
      },
    ];

    const qualidade: QualidadeKPI[] = qualDefs.map((d) => {
      const rowsAtual = d.rows(atual);
      const notas = rowsAtual.map((r) => r.nota);
      const vals = notas.filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 5);
      return {
        key: d.key,
        label: d.label,
        media: mediaNotas(notas),
        mediaAnterior: mediaNotas(d.rows(anterior).map((r) => r.nota)),
        avaliacoes: vals.length,
        abaixoDe4: vals.filter((v) => v < 4).length,
        registros: rowsAtual
          .filter((r) => typeof r.nota === 'number')
          .map((r) => ({ nota: r.nota as number, unidade: r.unidade, turno: r.turno, nome: r.nome, created_at: r.created_at, tabela: r.tabela, id: r.id })),
      };
    });
    const qualMap = Object.fromEntries(qualidade.map((q) => [q.key, q.media]));
    const qualMapAnt = Object.fromEntries(qualidade.map((q) => [q.key, q.mediaAnterior]));

    const indice = calcularIndice(qualMap, qualMapAnt);
    const indiceAnterior = calcularIndice(qualMapAnt);

    /* ------------------------------ Distribuição ---------------------------- */
    const distribuicao = calcularDistribuicao(atual.atendimentos);

    /* -------------------------- Atendimentos/treinador ---------------------- */
    const porTreinadorMap = new Map<
      string,
      { treinador: string; total: number; dias: Set<string>; unidades: Set<string>; turnos: Set<string>; registros: AtendimentoRow[] }
    >();
    atual.atendimentos.forEach((r) => {
      if (!r.treinador || !r.quantidade || r.quantidade <= 0) return;
      const cur =
        porTreinadorMap.get(r.treinador) ??
        { treinador: r.treinador, total: 0, dias: new Set<string>(), unidades: new Set<string>(), turnos: new Set<string>(), registros: [] };
      cur.total += r.quantidade;
      cur.dias.add(r.data);
      cur.unidades.add(r.unidade);
      cur.turnos.add(r.turno);
      cur.registros.push(r);
      porTreinadorMap.set(r.treinador, cur);
    });
    const porTreinador = [...porTreinadorMap.values()]
      .map((t) => ({
        treinador: t.treinador,
        total: t.total,
        mediaDiaria: t.dias.size ? t.total / t.dias.size : 0,
        unidades: [...t.unidades],
        turnos: [...t.turnos],
        registros: t.registros.slice().sort((a, b) => (a.data < b.data ? 1 : -1)),
      }))
      .sort((a, b) => b.total - a.total);

    /* ------------------------------- Evolução ------------------------------- */
    const buildSerie = (granularidade: 'dia' | 'semana' | 'mes') => {
      const bucket = (d: string) => {
        if (granularidade === 'dia') return d;
        if (granularidade === 'mes') return d.slice(0, 7);
        const dt = new Date(d + 'T12:00:00');
        const dow = dt.getDay();
        dt.setDate(dt.getDate() - dow);
        return isoDate(dt);
      };
      const map = new Map<string, { label: string; atendimentos: number; treinadores: Set<string>; notas: Record<string, number[]> }>();
      const ensure = (k: string) => {
        if (!map.has(k)) map.set(k, { label: k, atendimentos: 0, treinadores: new Set(), notas: {} });
        return map.get(k)!;
      };
      const addNota = (k: string, key: string, v: number | null | undefined) => {
        if (typeof v !== 'number' || v < 1 || v > 5) return;
        const e = ensure(k);
        (e.notas[key] ??= []).push(v);
      };
      atual.atendimentos.forEach((r) => {
        if (!r.quantidade || r.quantidade <= 0) return;
        const e = ensure(bucket(r.data));
        e.atendimentos += r.quantidade;
        if (r.treinador) e.treinadores.add(r.treinador);
      });
      atual.coordenador.forEach((r) => {
        const k = bucket(dateFromTimestamp(r.created_at));
        addNota(k, 'limpeza', r.limpeza_geral);
        addNota(k, 'organizacao', r.organizacao_espaco);
        addNota(k, 'climatizacao', r.climatizacao);
        addNota(k, 'equipamentos', r.equipamentos_funcionando);
        addNota(k, 'postura', r.postura_atendimento);
        addNota(k, 'proatividade', r.proatividade);
        addNota(k, 'nota_geral', r.nota_geral);
      });
      atual.turno.forEach((r) => addNota(bucket(dateFromTimestamp(r.created_at)), 'clima', r.clima_equipe));
      atual.horario.forEach((r) => addNota(bucket(r.data), 'nota_geral', r.nota_geral));

      const avg = (arr?: number[]) => (arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
      return [...map.values()]
        .sort((a, b) => (a.label < b.label ? -1 : 1))
        .map((e) => ({
          periodo: e.label,
          atendimentos: e.atendimentos,
          media_treinador: e.treinadores.size ? Number((e.atendimentos / e.treinadores.size).toFixed(2)) : null,
          limpeza: avg(e.notas.limpeza),
          organizacao: avg(e.notas.organizacao),
          climatizacao: avg(e.notas.climatizacao),
          equipamentos: avg(e.notas.equipamentos),
          clima: avg(e.notas.clima),
          postura: avg(e.notas.postura),
          proatividade: avg(e.notas.proatividade),
          nota_geral: avg(e.notas.nota_geral),
        }));
    };

    /* -------------------------------- Equipe -------------------------------- */
    const coordComPresenca = atual.coordenador.filter((r) => typeof r.todos_compareceram === 'boolean');
    const presencaOk = coordComPresenca.filter((r) => r.todos_compareceram).length;
    const taxaPresenca = coordComPresenca.length ? (presencaOk / coordComPresenca.length) * 100 : null;
    const textosFaltas = [
      ...atual.coordenador.filter((r) => r.todos_compareceram === false).map((r) => r.faltas_atrasos ?? ''),
      ...atual.horario.filter((r) => r.treinador_faltou).map((r) => r.treinador_faltou_quem ?? ''),
    ];
    const atrasos = textosFaltas.filter((t) => /ATRAS/i.test(t)).length;
    const justificadas = textosFaltas.filter((t) => /JUSTIFIC/i.test(t) && !/N[ÃA]O JUSTIFIC/i.test(t)).length;
    const naoJustificadas = textosFaltas.filter((t) => /N[ÃA]O JUSTIFIC/i.test(t)).length;
    const faltas = textosFaltas.length - atrasos;

    const equipe = {
      taxaPresenca,
      faltas,
      atrasos,
      justificadas,
      naoJustificadas: naoJustificadas || Math.max(0, faltas - justificadas),
      feedbacksCorretivos:
        atual.coordenador.filter((r) => r.feedback_corretivo).length + atual.horario.filter((r) => r.feedback_corretivo).length,
      destaques: atual.coordenador.filter((r) => r.destaque_positivo).length + atual.horario.filter((r) => r.destaque_positivo).length,
      suportes: atual.turno.filter((r) => r.precisou_suporte).length,
      climaEquipe: mediaNotas(atual.turno.map((r) => r.clima_equipe)),
      detalhesFaltas: textosFaltas.filter((t) => t.trim()),
    };

    /* ------------------------------- Padrão EVO ----------------------------- */
    const padraoRespostas = [
      ...atual.coordenador
        .filter((r) => typeof r.padrao_iron === 'boolean')
        .map((r) => ({
          ok: !!r.padrao_iron,
          unidade: r.unidade,
          data: dateFromTimestamp(r.created_at),
          responsavel: r.nome,
          justificativa: r.fora_padrao_descricao,
          tabela: 'encerramento_coordenador_respostas',
          id: r.id,
        })),
      ...atual.turno.map((r) => ({
        ok: r.manteve_padrao,
        unidade: r.unidade,
        data: dateFromTimestamp(r.created_at),
        responsavel: r.nome,
        justificativa: r.padrao_observacao,
        tabela: 'encerramento_turno_respostas',
        id: r.id,
      })),
    ];
    const padraoAnteriorRespostas = [
      ...anterior.coordenador.filter((r) => typeof r.padrao_iron === 'boolean').map((r) => !!r.padrao_iron),
      ...anterior.turno.map((r) => r.manteve_padrao),
    ];
    const padraoEvo = {
      percentual: padraoRespostas.length ? (padraoRespostas.filter((p) => p.ok).length / padraoRespostas.length) * 100 : null,
      percentualAnterior: padraoAnteriorRespostas.length
        ? (padraoAnteriorRespostas.filter(Boolean).length / padraoAnteriorRespostas.length) * 100
        : null,
      total: padraoRespostas.length,
      fora: padraoRespostas.filter((p) => !p.ok),
    };

    /* ----------------------------- Pendências ------------------------------- */
    const derivadas = derivarPendencias({
      horario: atual.horario,
      coordenador: atual.coordenador,
      turno: atual.turno,
      formulariosFaltantes: faltantes,
    });
    const pendencias = mesclarTracking(derivadas, data.tracking, hoje);
    const ocorrenciasAbertas = pendencias.filter((p) => p.status !== 'resolvido').length;
    const derivadasAnt = derivarPendencias({
      horario: anterior.horario,
      coordenador: anterior.coordenador,
      turno: anterior.turno,
      formulariosFaltantes: [],
    });

    /* ------------------------- Comparativo unidades ------------------------- */
    const unidadesTodas = [...new Set([...data.horario, ...data.coordenador, ...data.turno].map((r) => r.unidade))].sort();
    const comparativo = unidadesTodas.map((u) => {
      const h = atual.horario.filter((r) => r.unidade === u);
      const c = atual.coordenador.filter((r) => r.unidade === u);
      const t = atual.turno.filter((r) => r.unidade === u);
      const a = atual.atendimentos.filter((r) => r.unidade === u);
      const total = somaAtendimentos(a);
      const trein = treinadoresAtivos(a).size;
      const prevU = combosPrevistos(filtros.start, filtros.end).filter((x) => x.unidade === u).length;
      const preU = new Set([
        ...h.map((r) => `${r.data}|${r.turno}`),
        ...t.map((r) => `${dateFromTimestamp(r.created_at)}|${r.turno}`),
        ...c.map((r) => `${dateFromTimestamp(r.created_at)}|${r.turno}`),
      ]).size;
      const presencaBase = c.filter((r) => typeof r.todos_compareceram === 'boolean');
      return {
        unidade: u,
        atendimentos: total,
        mediaTreinador: trein ? total / trein : null,
        experimentais: h.reduce((s, r) => s + (r.experimentais_realizadas ?? 0), 0) + t.reduce((s, r) => s + (r.experimentais_realizadas ?? 0), 0),
        limpeza: mediaNotas(c.map((r) => r.limpeza_geral)),
        organizacao: mediaNotas(c.map((r) => r.organizacao_espaco)),
        climatizacao: mediaNotas(c.map((r) => r.climatizacao)),
        equipamentos: mediaNotas(c.map((r) => r.equipamentos_funcionando)),
        clima: mediaNotas(t.map((r) => r.clima_equipe)),
        presenca: presencaBase.length ? (presencaBase.filter((r) => r.todos_compareceram).length / presencaBase.length) * 100 : null,
        ocorrencias: pendencias.filter((p) => p.unidade === u && p.status !== 'resolvido').length,
        taxaPreenchimento: prevU ? (preU / prevU) * 100 : null,
        indice: calcularIndice({
          limpeza: mediaNotas(c.map((r) => r.limpeza_geral)),
          organizacao: mediaNotas(c.map((r) => r.organizacao_espaco)),
          climatizacao: mediaNotas(c.map((r) => r.climatizacao)),
          equipamentos: mediaNotas(c.map((r) => r.equipamentos_funcionando)),
          infraestrutura: mediaNotas(c.map((r) => r.infraestrutura)),
          postura: mediaNotas(c.map((r) => r.postura_atendimento)),
          proatividade: mediaNotas(c.map((r) => r.proatividade)),
          clima: mediaNotas(t.map((r) => r.clima_equipe)),
        }).indice,
      };
    });

    /* --------------------------- Turnos encerrados -------------------------- */
    const turnos = {
      previstos: previstos.length,
      encerrados: preenchidos.size,
      pendentes: Math.max(0, previstos.length - preenchidos.size),
    };

    /* --------------------------------- Insights ---------------------------- */
    const insights: { texto: string; tipo: 'positivo' | 'atencao' | 'neutro' }[] = [];
    if (distribuicao) {
      insights.push({
        texto:
          distribuicao.classe === 'equilibrada'
            ? `Distribuição dos atendimentos equilibrada (amplitude de ${distribuicao.amplitude} atendimento(s) entre ${distribuicao.totalTreinadores} treinadores).`
            : `Distribuição ${distribuicao.classe === 'atencao' ? 'em atenção' : 'desequilibrada'}: ${distribuicao.maior?.treinador} fez ${distribuicao.maior?.quantidade} e ${distribuicao.menor?.treinador} fez ${distribuicao.menor?.quantidade}.`,
        tipo: distribuicao.classe === 'equilibrada' ? 'positivo' : 'atencao',
      });
    }
    const porTurno = new Map<string, number>();
    atual.atendimentos.forEach((r) => {
      if ((r.quantidade ?? 0) > 0) porTurno.set(r.turno, (porTurno.get(r.turno) ?? 0) + (r.quantidade as number));
    });
    const turnoTop = [...porTurno.entries()].sort((a, b) => b[1] - a[1])[0];
    if (turnoTop) insights.push({ texto: `Turno com maior volume: ${turnoTop[0]} com ${turnoTop[1]} atendimentos no período.`, tipo: 'neutro' });
    if (porTreinador[0])
      insights.push({
        texto: `${porTreinador[0].treinador} lidera com ${porTreinador[0].total} atendimentos (média de ${porTreinador[0].mediaDiaria.toFixed(1)}/dia).`,
        tipo: 'positivo',
      });
    qualidade.forEach((q) => {
      if (q.media !== null && q.mediaAnterior !== null && q.media < q.mediaAnterior - 0.3) {
        insights.push({
          texto: `${q.label} caiu de ${q.mediaAnterior.toFixed(1)} para ${q.media.toFixed(1)} em relação ao período anterior (${prev.start} a ${prev.end}).`,
          tipo: 'atencao',
        });
      }
    });
    comparativo.forEach((c) => {
      if (c.limpeza !== null && c.limpeza < 4)
        insights.push({ texto: `A limpeza da unidade ${c.unidade} está em ${c.limpeza.toFixed(1)} de 5 no período.`, tipo: 'atencao' });
      if (c.climatizacao !== null && qualMap.climatizacao !== null && c.climatizacao < (qualMap.climatizacao as number) - 0.2)
        insights.push({
          texto: `Climatização da unidade ${c.unidade} (${c.climatizacao.toFixed(1)}) está abaixo da média geral (${(qualMap.climatizacao as number).toFixed(1)}).`,
          tipo: 'atencao',
        });
    });
    // Reincidência: mesma categoria + unidade também presente no período anterior
    const chavesAnt = new Set(derivadasAnt.map((d) => `${d.unidade}|${d.categoria}`));
    const reincidentes = [...new Set(pendencias.filter((p) => chavesAnt.has(`${p.unidade}|${p.categoria}`)).map((p) => `${p.unidade}|${p.categoria}`))];
    reincidentes.slice(0, 3).forEach((k) => {
      const [u, cat] = k.split('|');
      insights.push({ texto: `Ocorrência reincidente de "${cat}" na unidade ${u} (também registrada no período anterior).`, tipo: 'atencao' });
    });
    if (equipe.faltas > 0 && anterior.coordenador.length)
      insights.push({ texto: `${equipe.faltas} registro(s) de falta e ${equipe.atrasos} de atraso no período.`, tipo: equipe.faltas > 2 ? 'atencao' : 'neutro' });
    if (faltantes.length) insights.push({ texto: `${faltantes.length} formulário(s) previsto(s) não foram preenchidos no período.`, tipo: 'atencao' });

    const contaCitacoes = (textos: (string | null)[]) => {
      const m = new Map<string, number>();
      textos.forEach((t) => {
        (t ?? '')
          .toUpperCase()
          .split(/[^A-ZÀ-Ÿ]+/)
          .filter((w) => w.length >= 4)
          .forEach((w) => m.set(w, (m.get(w) ?? 0) + 1));
      });
      return [...m.entries()].sort((a, b) => b[1] - a[1]).filter(([, n]) => n >= 3);
    };
    const destaquesTop = contaCitacoes([
      ...atual.coordenador.filter((r) => r.destaque_positivo).map((r) => r.destaque_descricao),
      ...atual.horario.filter((r) => r.destaque_positivo).map((r) => r.destaque_descricao),
    ])[0];
    if (destaquesTop) insights.push({ texto: `"${destaquesTop[0]}" foi citado ${destaquesTop[1]}x como destaque positivo.`, tipo: 'positivo' });
    const corretivoTop = contaCitacoes([
      ...atual.coordenador.filter((r) => r.feedback_corretivo).map((r) => r.feedback_descricao),
      ...atual.horario.filter((r) => r.feedback_corretivo).map((r) => r.feedback_corretivo_descricao),
    ])[0];
    if (corretivoTop) insights.push({ texto: `"${corretivoTop[0]}" apareceu ${corretivoTop[1]}x em feedbacks corretivos.`, tipo: 'atencao' });

    /* --------------------------------- Alertas ------------------------------ */
    const alertas = pendencias
      .filter((p) => p.status !== 'resolvido')
      .sort((a, b) => {
        const rank = { alta: 0, media: 1, baixa: 2 } as const;
        if (a.status === 'vencido' && b.status !== 'vencido') return -1;
        if (b.status === 'vencido' && a.status !== 'vencido') return 1;
        return rank[a.gravidade] - rank[b.gravidade] || (a.data < b.data ? 1 : -1);
      });

    return {
      ...empty,
      unidadesDisponiveis: unidadesTodas,
      funcionariosDisponiveis: [
        ...new Set([
          ...data.horario.map((r) => r.nome),
          ...data.coordenador.map((r) => r.nome),
          ...data.turno.map((r) => r.nome),
          ...data.atendimentos.map((r) => r.treinador ?? ''),
        ]),
      ]
        .filter(Boolean)
        .map((n) => n.toUpperCase())
        .filter((n, i, arr) => arr.indexOf(n) === i)
        .sort(),
      periodoAnterior: prev,
      produtividade: {
        totalAtendimentos,
        totalAtendimentosVar: variacao(totalAtendimentos, totalAtendimentosAnt),
        totalAtendimentosAnt,
        mediaTreinador,
        mediaTreinadorAnt,
        mediaTreinadorVar: variacao(mediaTreinador, mediaTreinadorAnt),
        experimentais: experimentais(atual),
        experimentaisAnt: experimentais(anterior),
        experimentaisVar: variacao(experimentais(atual), experimentais(anterior)),
        treinadoresAtivos: ativos.size,
        treinadoresAtivosAnt: ativosAnt.size,
        treinadoresAtivosVar: variacao(ativos.size, ativosAnt.size),
        taxaPreenchimento,
        taxaPreenchimentoAnt,
        taxaPreenchimentoVar: variacao(taxaPreenchimento, taxaPreenchimentoAnt),
        pendentesRevisao,
      },
      turnos,
      distribuicao,
      qualidade,
      indice,
      indiceAnterior: indiceAnterior.indice,
      porTreinador,
      buildSerie,
      equipe,
      padraoEvo,
      pendencias,
      ocorrenciasAbertas,
      comparativo,
      insights,
      alertas,
      registros: atual,
      temDados:
        atual.horario.length > 0 || atual.coordenador.length > 0 || atual.turno.length > 0,
    };
  }, [data, filtros.unidade, filtros.turno, filtros.funcao, filtros.funcionario, filtros.start, filtros.end, prev.start, prev.end]);

  return { data: result, isLoading, error, refetch };
}

export type OperacionalDashboardData = NonNullable<ReturnType<typeof useOperacionalDashboard>['data']>;
