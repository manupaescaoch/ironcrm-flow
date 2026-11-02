import {dispatchPreparedExperimental,experimentalReady,type ExperimentalReadiness} from './experimentalCyclesPrepared.ts';
/** Server-resolved evidence must never be sent back into legacy mutation on rollback. */
export async function routeExperimental<T>(args:{unitId:string;readiness:ExperimentalReadiness|null;hasCycleEvidence:boolean;legacy:()=>Promise<T>;traceable:()=>Promise<T>}):Promise<T>{
 if(args.hasCycleEvidence){
  if(!experimentalReady(args.readiness,args.unitId))throw new Error('Agendamento rastreado bloqueado; evidências preservadas');
  return args.traceable();
 }
 return dispatchPreparedExperimental(args);
}