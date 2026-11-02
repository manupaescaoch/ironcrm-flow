/** FC-2A.1 preparation: no production caller or feature flag is enabled here. */
export type ExperimentalOperation='criar'|'editar'|'confirmar'|'reagendar'|'cancelar'|'inativar';
export const experimentalWriters = [
 'crm:create','lead-detail:create','lead-detail:edit','lead-detail:lead-slot','lead-detail:delete',
 'dashboard:remove','events-today:attendance','events-today:absence','events-today:cancel','events-today:trainer',
 'confirmations-tomorrow:edit','confirmations-tomorrow:cancel','reschedule-modal','evochat:inbound',
 'telegram:callback','telegram:send','telegram:synchronize',
] as const;
export type ExperimentalWriter=typeof experimentalWriters[number];
export interface ExperimentalReadiness {
 approved:boolean;
 enabled:boolean;
 unitId:string;
 receptionUserId:string|null;
 receptionVerified:boolean;
 coveredWriters:readonly ExperimentalWriter[];
}
export function experimentalReady(config:ExperimentalReadiness|null,unitId:string):boolean {
 return config?.approved===true&&config.enabled===true&&config.unitId===unitId&&config.receptionUserId!==null&&config.receptionVerified===true&&experimentalWriters.every(w=>config.coveredWriters.includes(w));
}
/** Lazy legacy callback is exactly once; a traced error NEVER falls back after a possible commit. */
export async function dispatchPreparedExperimental<T>(args:{unitId:string;readiness:ExperimentalReadiness|null;legacy:()=>Promise<T>;traceable:()=>Promise<T>}):Promise<T> {
 return experimentalReady(args.readiness,args.unitId)?args.traceable():args.legacy();
}
export const noShowNotificationKey=(cycleId:string)=>`experimental-recepcao:${cycleId}`;
export function explicitAttendanceChange(original:'pendente'|'compareceu'|'nao_compareceu',chosen:'pendente'|'compareceu'|'nao_compareceu',touched:boolean) {
 return touched&&chosen!=='pendente'&&chosen!==original?chosen:null;
}