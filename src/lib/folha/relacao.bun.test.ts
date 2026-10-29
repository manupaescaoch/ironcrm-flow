import {it,expect} from "bun:test";
import {agruparPagamentos,type LinhaPagamento} from "./relacao";
const l:LinhaPagamento={unidade_id:"MD",unidade_nome:"MADALENA TESTE",competencia:"2028-02",colaborador_id:"V1",pessoa_id:"P1",nome:"PESSOA TESTE",vinculo:"CLT",liquido:1150,situacao:"pendente",data_pagamento:null,previa:false};
it("pessoa recebe 1150 e 2000 em unidades distintas",()=>expect(agruparPagamentos([l,{...l,unidade_id:"ST",liquido:2000}]).reduce((s,u)=>s+u.total,0)).toBe(3150));
it("recusa duplicidade por pessoa unidade mês",()=>expect(()=>agruparPagamentos([l,{...l,colaborador_id:"V2"}])).toThrow());
it("pendente não ganha data",()=>expect(agruparPagamentos([l])[0].grupos.get("CLT")?.[0].data_pagamento).toBeNull());
