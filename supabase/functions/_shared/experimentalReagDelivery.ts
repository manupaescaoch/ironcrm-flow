/** Prepared delivery owner. `invokeExistingReag` must call the existing authenticated REAG, never a new provider. */
export async function deliverCycleReag(deps:{claim:()=>Promise<{claimed:boolean;lead_id?:string;interacao_id?:string}>;invokeExistingReag:(lead:string,interaction:string)=>Promise<boolean>;finish:(ok:boolean)=>Promise<void>}){
 const claim=await deps.claim();if(!claim.claimed)return {called:false};
 if(!claim.lead_id||!claim.interacao_id){await deps.finish(false);throw new Error('Reserva incompleta');}
 let ok=false;
 try{ok=await deps.invokeExistingReag(claim.lead_id,claim.interacao_id);}catch{await deps.finish(false);return {called:true,uncertain:true};}
 await deps.finish(ok);return {called:true,uncertain:!ok};
}