export type ContactIdentity = { taskId: string; leadId: string; enrollmentId: string; unitId: string; stage: string };
export function contactKey(identity: ContactIdentity): string {
  return JSON.stringify([identity.taskId, identity.leadId, identity.enrollmentId, identity.unitId, identity.stage]);
}
export function contactMatches(current: string, loaded: string | undefined): boolean {
  return !!loaded && current === loaded;
}