import { runtime } from './runtime.ts';
if (import.meta.main) Deno.serve(runtime('commercial'));
