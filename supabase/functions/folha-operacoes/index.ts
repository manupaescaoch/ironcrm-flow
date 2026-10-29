// Operações financeiras da folha: fechar, confirmar, desfazer, reabrir.
// Valores são SEMPRE recalculados aqui com o motor compartilhado, a partir do que está gravado.
// Confirmar é só um registro interno: nunca executa PIX, transferência ou integração externa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { calcularFolha, linhasCompetencia, mesclarRegras, VERSAO_CALCULO, FUNCOES_FORMADO } from "../_shared/folhaMotor.ts";
import { contextoImportacaoValido, podeLimparTentativa } from "../_shared/folhaImportacaoRegras.ts";
import { linhaClara, totalClara, normalizarPix, type EscolhaClara, type FonteClara } from "../_shared/folhaClara.ts";

function semDadosPessoais(v: any): any {
  if (Array.isArray(v)) return v.map(semDadosPessoais);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => !["cpf", "pix"].includes(k.toLowerCase())).map(([k, val]) => [k, semDadosPessoais(val)]));
  return v;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const cents = (v: number) => Math.round(v * 100) / 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COMP = /^\d{4}-(0[1-9]|1[0-2])$/;
const BUCKET = "folha-documentos";
function ultimosMeses(comp: string, n: number) {
  const [y, m] = comp.split("-").map(Number); const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(y, m - 1 - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  return out;
}
/** Linhas e totais da competência: fechada → retrato histórico; aberta → recálculo com dados gravados. */
class CalculoIndisponivel extends Error {}
async function calcularCompetencia(admin: any, unidade: string, comp: string) {
  const [k, un] = await Promise.all([
    admin.from("folha_competencias").select("*").eq("unidade_id", unidade).eq("competencia", comp).maybeSingle(),
    admin.from("unidades").select("id, nome").eq("id", unidade).single(),
  ]);
  // Nunca apresentar defaults ou totais parciais: qualquer falha interrompe prévia e exportação.
  if (k.error || un.error || !un.data) throw new CalculoIndisponivel(`Cálculo de ${comp} indisponível: falha ao ler competência ou unidade`);
  let regras, colabs: any[], lancs: any[], fechada = false;
  if (k.data?.status === "fechada") {
    if (!k.data.snapshot || !k.data.regras) throw new CalculoIndisponivel(`Cálculo de ${comp} indisponível: retrato fechado incompleto`);
    fechada = true; regras = mesclarRegras(k.data.regras, k.data.versao_calculo ?? "historica"); colabs = k.data.snapshot.colaboradores || []; lancs = k.data.snapshot.lancamentos || [];
  } else {
    const [cfg, cs, ls] = await Promise.all([
      admin.from("folha_config").select("regras").eq("id", 1).maybeSingle(),
      admin.from("folha_colaboradores").select("*").eq("unidade_id", unidade),
      admin.from("folha_lancamentos").select("*").eq("unidade_id", unidade).eq("competencia", comp),
    ]);
    if (cfg.error || cs.error || ls.error) throw new CalculoIndisponivel(`Cálculo de ${comp} indisponível: falha ao ler regras, colaboradores ou lançamentos`);
    if (!cfg.data?.regras || typeof cfg.data.regras !== "object" || Array.isArray(cfg.data.regras)) throw new CalculoIndisponivel("Cálculo indisponível: configuração da folha ausente");
    regras = mesclarRegras(cfg.data.regras);
    colabs = (cs.data || []).map((c: any) => ({ ...c, base: Number(c.base), passagem: Number(c.passagem) }));
    lancs = (ls.data || []).map((l: any) => ({ ...l, liquido_importado: l.liquido_importado == null ? null : Number(l.liquido_importado) }));
  }
  const linhas = linhasCompetencia(colabs, lancs, regras, !fechada, fechada ? k.data.versao_calculo ?? "historica" : VERSAO_CALCULO).map((x) => ({
    colaborador: { id: x.colaborador.id, pessoa_id: (x.colaborador as any).pessoa_id, nome: x.colaborador.nome, tipo: x.colaborador.tipo, funcao: x.colaborador.funcao ?? null, turno: x.colaborador.turno ?? null, cpf: (x.colaborador as any).cpf ?? null, pix: (x.colaborador as any).pix ?? null },
    resultado: x.resultado,
  }));
  const total = cents(linhas.reduce((a, x) => a + x.resultado.total, 0));
  const composicao = { base: 0, passagem: 0, adicionais: 0, comissao: 0, descontos: 0, contracheque_importado: 0 };
  for (const { resultado: r } of linhas) {
    if (r.contrachequeImportado) { composicao.contracheque_importado += r.total; continue; }
    composicao.base += r.base; composicao.passagem += r.passagem; composicao.adicionais += r.extras; composicao.comissao += r.comissao; composicao.descontos += r.desconto;
  }
  for (const key in composicao) (composicao as any)[key] = cents((composicao as any)[key]);
  return { unidade: un.data, competencia: comp, fechada, versao_calculo: fechada ? k.data.versao_calculo : VERSAO_CALCULO, linhas, total, composicao,
    total_fechamento: fechada ? Number(k.data.total) : null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Configuração indisponível" }, 503);
  const admin = createClient(url, key);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  const usuario = u?.user?.id;
  if (!usuario) return json({ error: "Não autenticado" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido" }, 400); }
  const acao = String(body?.acao || "");
  const pode = async (unidade: string, a: string) => {
    if (a === "reabrir") { const { data } = await admin.rpc("has_role", { _user_id: usuario, _role: "admin" }); return !!data; }
    const { data } = await admin.rpc("folha_pode", { _user_id: usuario, _unidade_id: unidade, _acao: a });
    return !!data;
  };

  try {
    if (["previa_clara", "exportar_clara", "previa_ajuda_clara", "exportar_ajuda_clara"].includes(acao)) {
      const unidade = String(body.unidade_id || ""), comp = String(body.competencia || "");
      if (!UUID.test(unidade) || !COMP.test(comp)) return json({ error: "Parâmetros inválidos" }, 400);
      for (const a of ["ver", "documentos", "dados_pessoais"]) if (!(await pode(unidade, a))) return json({ error: "Lote Clara exige acesso à folha, exportação e CPF/PIX nesta unidade" }, 403);
      const ajuda = acao.includes("ajuda");
      const exportar = acao.startsWith("exportar");
      if (ajuda && ![1,2].includes(body.parcela)) return json({ error: "Parcela inválida" }, 400);
      const escolhas: EscolhaClara[] = Array.isArray(body.escolhas) ? body.escolhas : [];
      if (exportar && (!escolhas.length || escolhas.length > 300 || escolhas.some(e => !UUID.test(String(e.pagamento_id))) || new Set(escolhas.map(e => e.pagamento_id)).size !== escolhas.length)) return json({ error: "Seleção inválida" }, 400);
      const args = { p_usuario: usuario, p_unidade: unidade, p_comp: comp, p_ids: exportar ? escolhas.map(e => e.pagamento_id) : null, ...(ajuda ? { p_parcela: body.parcela } : {}) };
      const rpc = ajuda ? "folha_lote_ajuda" : "folha_lote_clara";
      const { data: previa, error: ep } = await admin.rpc(rpc, args);
      if (ep) return json({ error: ep.message }, ep.code === "42501" ? 403 : 400);
      if (!exportar) return json(previa);
      const descricao = `EVO Club | ${previa.unidade_nome} | ${ajuda ? `Ajuda parcela ${body.parcela}` : "Folha"} ${comp.slice(5)}/${comp.slice(0, 4)}`;
      let linhas;
      try { linhas = (previa.fontes as FonteClara[]).map(f => { const e = escolhas.find(e => e.pagamento_id === f.pagamento_id); if (!e) throw new Error("Seleção inválida"); return linhaClara(f, e, descricao); }); }
      catch (e) { return json({ error: (e as Error).message }, 400); }
      const { data: audit, error: ea } = await admin.rpc(rpc, { ...args, p_exportar: true, p_reexportar: body.reexportar === true, p_hash: previa.hash, p_opcoes: escolhas.map(e => ({ pagamento_id: e.pagamento_id, tipo: e.tipo || null, fornecedor_cadastrado: e.fornecedor_cadastrado === true })) });
      if (ea) return json({ error: ea.message }, ea.code === "PT409" ? 409 : 400);
      if (audit.reexportacao_necessaria) return json(audit);
      return json({ linhas, total: totalClara(linhas), unidade_nome: previa.unidade_nome, competencia: comp, auditoria_id: audit.auditoria_id });
    }
    if (acao === "dados_tela") {
      const unidade = String(body.unidade_id || ""), comp = String(body.competencia || "");
      if (!UUID.test(unidade) || !COMP.test(comp)) return json({ error: "Parâmetros inválidos" }, 400);
      if (!(await pode(unidade, "ver"))) return json({ error: "Sem acesso à folha desta unidade" }, 403);
      const [cs, ps, ks, au] = await Promise.all([
        admin.from("folha_colaboradores").select("*").eq("unidade_id", unidade).order("nome"),
        admin.from("folha_pagamentos").select("*").eq("unidade_id", unidade).eq("competencia", comp),
        admin.from("folha_competencias").select("*").eq("unidade_id", unidade).eq("competencia", comp).maybeSingle(),
        admin.from("folha_auditoria").select("*").eq("unidade_id", unidade).order("created_at", { ascending: false }).limit(100),
      ]);
      if (cs.error || ps.error || ks.error || au.error) throw cs.error || ps.error || ks.error || au.error;
      const r = { colaboradores: cs.data, pagamentos: ps.data, competencia: ks.data, auditoria: au.data };
      return json(await pode(unidade, "dados_pessoais") ? r : semDadosPessoais(r));
    }
    if (acao === "salvar_colaborador" || acao === "inativar_colaborador") {
      const unidade = String(body.unidade_id || ""), id = String(body.colaborador_id || "");
      if (!UUID.test(unidade) || !(await pode(unidade, "ver")) || !(await pode(unidade, "colaboradores"))) return json({ error: "Sem permissão nesta unidade" }, 403);
      const { data: atual } = id ? await admin.from("folha_colaboradores").select("*").eq("id", id).eq("unidade_id", unidade).maybeSingle() : { data: null };
      if (id && !atual) return json({ error: "Vínculo não encontrado nesta unidade" }, 404);
      const entrada = body.dados || {};
      if (!(await pode(unidade, "dados_pessoais")) && (entrada.cpf !== undefined || entrada.pix !== undefined)) return json({ error: "Sem permissão explícita para CPF e PIX" }, 403);
      const row: any = { unidade_id: unidade };
      if (acao === "inativar_colaborador") {
        if (atual?.tipo === "SEM_CONTRATO" && !atual.ativo) return json({ error: "Sem contrato: ativação aguarda regra de cálculo" }, 400);
        row.ativo = !atual?.ativo;
      }
      else {
        if (!String(entrada.nome || "").trim() || !["CLT", "ESTAGIARIO", "SEM_CONTRATO"].includes(entrada.tipo)) return json({ error: "Nome e vínculo são obrigatórios" }, 400);
        for (const campo of ["nome", "tipo", "funcao", "funcao_remuneratoria", "turno", "turno2", "base", "passagem", "lider", "lider_valor", "valor_fds", "valor_feriado", "cpf", "pix"]) if (entrada[campo] !== undefined) row[campo] = entrada[campo];
        for (const campo of ["base", "passagem", "lider_valor", "valor_fds", "valor_feriado"]) if (row[campo] != null && (!Number.isFinite(Number(row[campo])) || Number(row[campo]) < 0 || Number(row[campo]) > 1e6)) return json({ error: "Remuneração inválida" }, 400);
        row.nome = String(entrada.nome).trim().toUpperCase();
        // Função remuneratória: identificador explícito; nunca deduzido do texto da função.
        if (row.funcao_remuneratoria === "") row.funcao_remuneratoria = null;
        if (row.funcao_remuneratoria != null && !(FUNCOES_FORMADO as readonly string[]).includes(String(row.funcao_remuneratoria))) return json({ error: "Função remuneratória inválida" }, 400);
        if (row.funcao_remuneratoria != null && entrada.tipo !== "CLT") return json({ error: "Função remuneratória de formado exige vínculo CLT" }, 400);
        // PIX: preserva exatamente a chave digitada (sem maiúsculas) e valida pelo tipo informado.
        if (row.pix != null) {
          const pix = String(row.pix).trim();
          if (!pix) row.pix = null;
          else {
            if (!["cpf", "cnpj", "telefone", "email", "aleatoria"].includes(String(entrada.pix_tipo || ""))) return json({ error: "Informe o tipo da chave PIX" }, 400);
            if (!normalizarPix(pix, entrada.pix_tipo)) return json({ error: "Chave PIX inválida para o tipo informado" }, 400);
            row.pix = pix;
          }
        }
        if (entrada.tipo === "SEM_CONTRATO") row.ativo = false;
        // Um vínculo de origem deve estar acessível; nunca aceitar pessoa_id arbitrário.
        if (body.vinculo_origem_id) {
          const { data: origem } = await admin.from("folha_colaboradores").select("id,pessoa_id,unidade_id").eq("id", String(body.vinculo_origem_id)).maybeSingle();
          if (!origem || !(await pode(origem.unidade_id, "ver")) || !(await pode(origem.unidade_id, "colaboradores"))) return json({ error: "Sem acesso ao vínculo de origem" }, 403);
          row.pessoa_id = origem.pessoa_id;
        }
      }
      const { data, error } = await admin.rpc("folha_salvar_vinculo", { p_usuario: usuario, p_unidade: unidade, p_id: id || null, p_dados: row });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }
    // Excluir vínculo: só sem qualquer histórico de folha; com histórico, o caminho é inativar.
    if (acao === "excluir_colaborador") {
      const unidade = String(body.unidade_id || ""), id = String(body.colaborador_id || "");
      if (!UUID.test(unidade) || !UUID.test(id)) return json({ error: "Parâmetros inválidos" }, 400);
      if (!(await pode(unidade, "ver")) || !(await pode(unidade, "colaboradores"))) return json({ error: "Sem permissão nesta unidade" }, 403);
      const { data: atual } = await admin.from("folha_colaboradores").select("*").eq("id", id).eq("unidade_id", unidade).maybeSingle();
      if (!atual) return json({ error: "Vínculo não encontrado nesta unidade" }, 404);
      const [lan, pag, itens, aj] = await Promise.all([
        admin.from("folha_lancamentos").select("id", { count: "exact", head: true }).eq("colaborador_id", id),
        admin.from("folha_pagamentos").select("id", { count: "exact", head: true }).eq("colaborador_id", id),
        admin.from("folha_contracheque_itens").select("id", { count: "exact", head: true }).eq("colaborador_id", id),
        admin.from("folha_ajuda_parcelas").select("id", { count: "exact", head: true }).eq("colaborador_id", id),
      ]);
      if (lan.error || pag.error || itens.error || aj.error) return json({ error: (lan.error || pag.error || itens.error || aj.error)!.message }, 500);
      const comHistorico = (lan.count || 0) + (pag.count || 0) + (itens.count || 0) + (aj.count || 0);
      if (comHistorico > 0) return json({ error: "Vínculo tem histórico de folha gravada; use Inativar em vez de excluir" }, 409);
      const { error: edel } = await admin.from("folha_colaboradores").delete().eq("id", id).eq("unidade_id", unidade);
      if (edel) return json({ error: edel.message }, 400);
      // A tabela não tem gatilho de exclusão: registra a auditoria aqui.
      const { error: eaud } = await admin.from("folha_auditoria").insert({ tabela: "folha_colaboradores", registro_id: id, unidade_id: unidade, competencia: null, acao: "DELETE", antes: atual, user_id: usuario });
      if (eaud) console.error("[folha-operacoes] auditoria de exclusão falhou:", eaud.message);
      return json({ ok: true, id });
    }
    if (acao === "fechar") {
      const unidade = String(body.unidade_id || ""), comp = String(body.competencia || "");
      if (!/^[0-9a-f-]{36}$/.test(unidade) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(comp)) return json({ error: "Parâmetros inválidos" }, 400);
      if (!(await pode(unidade, "fechar"))) return json({ error: "Sem permissão para fechar a folha desta unidade" }, 403);
      const { data: existente } = await admin.from("folha_competencias").select("id,status,total").eq("unidade_id", unidade).eq("competencia", comp).maybeSingle();
      if (existente?.status === "fechada") return json({ ok: true, ja_fechada: true, competencia_id: existente.id, total: existente.total });
      // Lê a impressão digital ANTES dos dados; o fechamento recusa se algo mudou depois.
      const { data: hash, error: eh } = await admin.rpc("folha_hash_entrada", { p_unidade: unidade, p_comp: comp });
      if (eh) throw eh;
      const [cfg, cs, ls, un] = await Promise.all([
        admin.from("folha_config").select("regras, updated_at").eq("id", 1).single(),
        admin.from("folha_colaboradores").select("*").eq("unidade_id", unidade),
        admin.from("folha_lancamentos").select("*").eq("unidade_id", unidade).eq("competencia", comp),
        admin.from("unidades").select("id, nome").eq("id", unidade).single(),
      ]);
      if (cfg.error || cs.error || ls.error || un?.error) throw new CalculoIndisponivel("Fechamento interrompido: falha ao ler regras, colaboradores, lançamentos ou unidade");
      if (!cfg.data?.regras || typeof cfg.data.regras !== "object" || Array.isArray(cfg.data.regras)) throw new CalculoIndisponivel("Fechamento interrompido: configuração da folha ausente");
      const regras = mesclarRegras(cfg.data.regras);
      const colabs = (cs.data || []).map((c: any) => ({ ...c, base: Number(c.base), passagem: Number(c.passagem) }));
      const lancs = (ls.data || []).map((l: any) => ({ ...l, liquido_importado: l.liquido_importado == null ? null : Number(l.liquido_importado) }));
      const linhas = linhasCompetencia(colabs, lancs, regras, true);
      if (!linhas.length) return json({ error: "Nenhum colaborador na competência" }, 400);
      const pagamentos = linhas.map((x) => ({ colaborador_id: x.colaborador.id, colaborador_nome: x.colaborador.nome, pix: (x.colaborador as any).pix ?? null, valor: x.resultado.total }));
      const total = cents(pagamentos.reduce((a, p) => a + p.valor, 0));
      const snapshot = {
        versao_calculo: VERSAO_CALCULO, gerado_em: new Date().toISOString(), unidade: un.data, competencia: comp,
        regras_atualizadas_em: cfg.data.updated_at,
        colaboradores: linhas.map((x) => x.colaborador),
        lancamentos: linhas.map((x) => x.lancamento ?? { colaborador_id: x.colaborador.id, competencia: comp, dados: {}, liquido_importado: null }),
        resultados: linhas.map((x) => ({ colaborador_id: x.colaborador.id, ...x.resultado })),
        total,
      };
      const { data, error } = await admin.rpc("folha_registrar_fechamento", {
        p_unidade: unidade, p_comp: comp, p_usuario: usuario, p_hash: hash, p_regras: regras, p_snapshot: snapshot,
        p_pagamentos: pagamentos, p_versao: VERSAO_CALCULO, p_total: total,
      });
      if (error) return json({ error: error.message }, error.code === "PT409" || error.code === "40001" ? 409 : 400);
      return json(data);
    }

    if (acao === "criar_obrigacoes" || body.conta_id) return json({ error: "Caminho legado desativado: Folha independente de Contas a Pagar" }, 410);
    if (acao === "confirmar" || acao === "desfazer") {
      let id = String(body.pagamento_id || "");
      const { data: p } = await admin.from("folha_pagamentos").select("*").eq("id", id).maybeSingle();
      if (!p) return json({ error: "Pagamento não encontrado" }, 404);
      // Unidade vem do registro gravado, nunca do navegador.
      if (!(await pode(p.unidade_id, "ver")) || !(await pode(p.unidade_id, acao))) return json({ error: "Sem permissão para esta ação nesta unidade" }, 403);
      let valor: number | null = null;
      if (acao === "confirmar") {
        const { data: k } = await admin.from("folha_competencias").select("*").eq("unidade_id", p.unidade_id).eq("competencia", p.competencia).maybeSingle();
        if (!k || k.status !== "fechada" || !k.snapshot) return json({ error: "Competência não está fechada" }, 400);
        const c = (k.snapshot.colaboradores || []).find((x: any) => x.id === p.colaborador_id);
        const l = (k.snapshot.lancamentos || []).find((x: any) => x.colaborador_id === p.colaborador_id);
        if (!c) return json({ error: "Colaborador fora do retrato fechado" }, 400);
        valor = calcularFolha(c, l?.dados, mesclarRegras(k.regras, k.versao_calculo ?? "historica"), l?.liquido_importado ?? null, k.versao_calculo ?? "historica").total;
      }
      const { data, error } = await admin.rpc("folha_registrar_pagamento_interno", { p_pagamento: id, p_usuario: usuario, p_acao: acao, p_valor: valor, p_motivo: String(body.motivo || "") });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    if (acao === "reabrir") {
      const { data: k } = await admin.from("folha_competencias").select("id, unidade_id").eq("id", String(body.competencia_id || "")).maybeSingle();
      if (!k) return json({ error: "Competência não encontrada" }, 404);
      if (!(await pode(k.unidade_id, "reabrir"))) return json({ error: "Somente administradores reabrem competências" }, 403);
      const { data, error } = await admin.rpc("folha_registrar_reabertura", { p_competencia: k.id, p_usuario: usuario });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    if (acao === "painel" || acao === "dados_exportacao" || acao === "relacao_pagamentos") {
      const comp = String(body.competencia || "");
      if (!COMP.test(comp)) return json({ error: "Competência inválida" }, 400);
      const pedidas: string[] = Array.isArray(body.unidades) ? body.unidades.map(String).filter((x: string) => UUID.test(x)) : [];
      if (!pedidas.length) return json({ error: "Informe a unidade" }, 400);
      const precisa = acao === "painel" ? "ver" : "documentos";
      const permitidas: string[] = [];
      for (const u of [...new Set(pedidas)]) if (await pode(u, "ver") && await pode(u, precisa)) permitidas.push(u);
      if (!permitidas.length) return json({ error: "Sem permissão para estas unidades" }, 403);
      if (acao === "dados_exportacao") {
        if (permitidas.length !== 1 || pedidas.length !== 1) return json({ error: "Exporte uma unidade por vez" }, 400);
        const r = await calcularCompetencia(admin, permitidas[0], comp);
        return json({ ...semDadosPessoais(r), gerado_em: new Date().toISOString(), documento: "DEMONSTRATIVO INTERNO — não substitui contracheque oficial" });
      }
      if (acao === "relacao_pagamentos") {
        if (permitidas.length !== new Set(pedidas).size) return json({ error: "Sem permissão para exportar uma das unidades solicitadas" }, 403);
        if (body.incluir_dados_pessoais) for (const u of permitidas) if (!(await pode(u, "dados_pessoais"))) return json({ error: "CPF e PIX exigem permissão explícita em todas as unidades" }, 403);
        const linhas: any[] = [];
        for (const unidade of permitidas) {
          const r = await calcularCompetencia(admin, unidade, comp);
          const { data: pagamentos, error } = await admin.from("folha_pagamentos").select("*").eq("unidade_id", unidade).eq("competencia", comp);
          if (error) throw error;
          for (const l of r.linhas) {
            const p = (pagamentos || []).find((p: any) => p.colaborador_id === l.colaborador.id);
            linhas.push({ unidade_id: unidade, unidade_nome: r.unidade.nome, competencia: comp, colaborador_id: l.colaborador.id, pessoa_id: l.colaborador.pessoa_id, nome: l.colaborador.nome, cargo: l.colaborador.funcao, vinculo: l.colaborador.tipo, cpf: l.colaborador.cpf, pix: p?.pix ?? l.colaborador.pix, liquido: p ? Number(p.valor_confirmado ?? p.valor) : l.resultado.total, situacao: p?.status === "pago" ? "pago" : "pendente", data_pagamento: p?.status === "pago" && p.confirmado_em ? new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Recife" }).format(new Date(p.confirmado_em)) : null, previa: !r.fechada });
          }
        }
        const filtradas = linhas.filter((l) => (!body.vinculo || body.vinculo === "todos" || l.vinculo === body.vinculo) && (!body.situacao || body.situacao === "todos" || l.situacao === body.situacao));
        return json({ competencia: comp, linhas: body.incluir_dados_pessoais ? filtradas : semDadosPessoais(filtradas), total: cents(filtradas.reduce((s, l) => s + l.liquido, 0)), dados_pessoais: !!body.incluir_dados_pessoais, gerado_em: new Date().toISOString() });
      }
      const meses = ultimosMeses(comp, 6);
      const unidades = [];
      for (const u of permitidas) {
        const evol = [];
        for (const m of meses) { const r = await calcularCompetencia(admin, u, m); evol.push({ competencia: m, total: r.total, fechada: r.fechada }); }
        const atual = await calcularCompetencia(admin, u, comp);
        const { data: pg, error: epg } = await admin.from("folha_pagamentos").select("status, valor, valor_confirmado").eq("unidade_id", u).eq("competencia", comp);
        if (epg) throw new CalculoIndisponivel("Painel indisponível: falha ao ler pagamentos");
        const pagos = (pg || []).filter((p: any) => p.status === "pago");
        unidades.push({
          unidade_id: u, nome: atual.unidade?.nome, fechada: atual.fechada, colaboradores: atual.linhas.length, total: atual.total,
          composicao: atual.composicao, pagos: pagos.length, valor_pago: cents(pagos.reduce((a: number, p: any) => a + Number(p.valor_confirmado ?? p.valor), 0)),
          pendentes: (pg || []).length - pagos.length, valor_pendente: cents((pg || []).filter((p: any) => p.status !== "pago").reduce((a: number, p: any) => a + Number(p.valor), 0)),
          evolucao: evol,
        });
      }
      return json({ competencia: comp, unidades, negadas: pedidas.length - permitidas.length });
    }

    if (acao === "preparar_importacao") {
      const unidade = String(body.unidade_id || ""), comp = String(body.competencia || ""), formato = String(body.formato || "");
      if (!UUID.test(unidade) || !COMP.test(comp) || !["pdf", "csv", "xlsx", "xls"].includes(formato)) return json({ error: "Parâmetros inválidos" }, 400);
      if (!(await pode(unidade, "importar"))) return json({ error: "Sem permissão nesta unidade" }, 403);
      const path = `${unidade}/${comp}/temporario-${crypto.randomUUID()}.${formato}`;
      const { data, error } = await admin.from("folha_importacao_tentativas").insert({ unidade_id: unidade, competencia: comp, usuario_id: usuario, arquivo_path: path }).select("id").single();
      if (error) throw error;
      return json({ tentativa_id: data.id, arquivo_path: path });
    }
    if (acao === "limpar_tentativa") {
      const { data: t } = await admin.from("folha_importacao_tentativas").select("*").eq("id", String(body.tentativa_id || "")).maybeSingle();
      if (!t || t.usuario_id !== usuario || !(await pode(t.unidade_id, "importar"))) return json({ error: "Sem permissão para esta tentativa" }, 403);
      const { data: vinculos, error: ev } = await admin.from("folha_contracheques").select("id").eq("arquivo_path", t.arquivo_path);
      if (ev) throw ev;
      if (vinculos.length || t.estado === "concluida") return json({ preservado: true });
      if (t.estado === "limpa") return json({ limpa: true });
      if (!podeLimparTentativa(t.estado, vinculos.length)) return json({ error: "Tentativa em processamento; limpeza recusada" }, 409);
      const { data: claim, error: ec } = await admin.from("folha_importacao_tentativas").update({ estado: "limpando" }).eq("id", t.id).in("estado", ["pendente", "recusada"]).select("id");
      if (ec) throw ec;
      if (!claim.length) return json({ error: "Tentativa em processamento; limpeza recusada" }, 409);
      const { error: er } = await admin.storage.from(BUCKET).remove([t.arquivo_path]);
      await admin.from("folha_importacao_tentativas").update({ estado: er ? "recusada" : "limpa" }).eq("id", t.id);
      if (er) throw er;
      return json({ limpa: true });
    }

    if (acao === "importar_contracheque") {
      const unidade = String(body.unidade_id || ""), comp = String(body.competencia || ""), path = String(body.arquivo_path || "");
      if (!UUID.test(unidade) || !COMP.test(comp)) return json({ error: "Parâmetros inválidos" }, 400);
      if (!(await pode(unidade, "importar"))) return json({ error: "Sem permissão para importar contracheques nesta unidade" }, 403);
      const { data: tentativa } = await admin.from("folha_importacao_tentativas").select("*").eq("id", String(body.tentativa_id || "")).maybeSingle();
      if (!tentativa || tentativa.usuario_id !== usuario || tentativa.unidade_id !== unidade || tentativa.arquivo_path !== path || !contextoImportacaoValido({ competencia: tentativa.competencia, unidade: tentativa.unidade_id }, { competencia: comp, unidade }) || body.competencia_revisada !== tentativa.competencia) return json({ error: "Competência/unidade diferente da prévia revisada" }, 400);
      if (!path.startsWith(`${unidade}/${comp}/`) || path.includes("..")) return json({ error: "Arquivo fora da pasta da unidade/competência" }, 400);
      const formato = String(body.formato || ""), extracao = String(body.extracao || "");
      if (!["pdf", "xlsx", "xls", "csv"].includes(formato) || !["texto_pdf", "planilha", "manual_ocr_pendente"].includes(extracao)) return json({ error: "Formato inválido" }, 400);
      const ref = body.referencia_detectada ? String(body.referencia_detectada) : null;
      if (ref && !COMP.test(ref)) return json({ error: "Referência detectada inválida" }, 400);
      if (ref && ref !== comp) return json({ error: `O contracheque é de ${ref}, mas a folha está em ${comp}` }, 400);
      if (!ref && body.competencia_confirmada !== true) return json({ error: "Competência não identificada no arquivo: confirme manualmente" }, 400);
      const itens = Array.isArray(body.itens) ? body.itens : [];
      if (!itens.length || itens.length > 300) return json({ error: "Itens inválidos" }, 400);
      for (const it of itens) {
        const l = Number(it?.liquido), b = Number(it?.bruto ?? 0);
        if (!UUID.test(String(it?.colaborador_id || "")) || !Number.isFinite(l) || l < 0 || l > 1e6 || !Number.isFinite(b) || b < 0) return json({ error: "Item com colaborador ou valores inválidos" }, 400);
      }
      const { data: claim, error: claimError } = await admin.from("folha_importacao_tentativas").update({ estado: "processando" }).eq("id", tentativa.id).eq("estado", "pendente").select("id");
      if (claimError) throw claimError;
      if (!claim.length) return json({ error: "Tentativa já utilizada ou em processamento" }, 409);
      try {
      // Hash calculado aqui, a partir do arquivo armazenado — nunca o informado pelo navegador.
      const dl = await admin.storage.from(BUCKET).download(path);
      if (dl.error || !dl.data) throw new Error("Arquivo não encontrado no armazenamento");
      const buf = new Uint8Array(await dl.data.arrayBuffer());
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buf))).map((x) => x.toString(16).padStart(2, "0")).join("");
      const { data, error } = await admin.rpc("folha_registrar_contracheque", {
        p_unidade: unidade, p_comp: comp, p_usuario: usuario, p_path: path, p_nome: String(body.arquivo_nome || "arquivo").slice(0, 200),
        p_hash: hash, p_formato: formato, p_extracao: extracao, p_ref: ref,
        p_itens: itens.map((it: any) => ({ colaborador_id: it.colaborador_id, liquido: cents(Number(it.liquido)), bruto: cents(Number(it.bruto || 0)), pagina: it.pagina ?? null, nome_lido: String(it.nome_lido || "").slice(0, 120), funcao: String(it.funcao || "").slice(0, 80) })),
      });
      if (error) throw error;
      await admin.from("folha_importacao_tentativas").update({ estado: "concluida" }).eq("id", tentativa.id);
      return json(data);
      } catch (error: any) {
        await admin.from("folha_importacao_tentativas").update({ estado: "recusada" }).eq("id", tentativa.id).eq("estado", "processando");
        return json({ error: error.message || "Importação recusada" }, 400);
      }
    }

    if (acao === "apagar_contracheque") {
      const { data: k } = await admin.from("folha_contracheques").select("id, unidade_id").eq("id", String(body.contracheque_id || "")).maybeSingle();
      if (!k) return json({ error: "Importação não encontrada" }, 404);
      if (!(await pode(k.unidade_id, "importar"))) return json({ error: "Sem permissão" }, 403);
      const { data, error } = await admin.rpc("folha_apagar_contracheque", { p_id: k.id, p_usuario: usuario });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    if (acao === "corrigir_contracheque") {
      const { data: it } = await admin.from("folha_contracheque_itens").select("id, unidade_id").eq("id", String(body.item_id || "")).maybeSingle();
      if (!it) return json({ error: "Item não encontrado" }, 404);
      if (!(await pode(it.unidade_id, "importar"))) return json({ error: "Sem permissão para corrigir importações nesta unidade" }, 403);
      const v = Number(body.liquido);
      if (!Number.isFinite(v)) return json({ error: "Valor inválido" }, 400);
      const { data, error } = await admin.rpc("folha_corrigir_contracheque_item", { p_item: it.id, p_usuario: usuario, p_liquido: cents(v), p_motivo: String(body.motivo || "") });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    if (acao === "link_documento") {
      const { data: k } = await admin.from("folha_contracheques").select("id, unidade_id, arquivo_path, arquivo_nome").eq("id", String(body.contracheque_id || "")).maybeSingle();
      if (!k) return json({ error: "Documento não encontrado" }, 404);
      // O original pode conter CPF: exige ver + documentos + dados_pessoais na unidade do documento.
      for (const a of ["ver", "documentos", "dados_pessoais"]) if (!(await pode(k.unidade_id, a))) return json({ error: "Original exige acesso à folha, documentos e CPF/PIX nesta unidade" }, 403);
      if (!String(k.arquivo_path || "").startsWith(`${k.unidade_id}/`)) return json({ error: "Documento fora da pasta da unidade" }, 403);
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(k.arquivo_path, 120, { download: k.arquivo_nome });
      if (error) return json({ error: error.message }, 400);
      return json({ url: data.signedUrl, expira_em_segundos: 120 });
    }
    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[folha-operacoes]", e);
    if (e instanceof CalculoIndisponivel || (e as Error).message?.startsWith("Cálculo indisponível")) return json({ error: (e as Error).message, calculo_indisponivel: true }, 503);
    return json({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
