import { handleWebhook } from '../_shared/handlers.ts';
import { makeDeps } from '../_shared/deps.ts';

const deps = makeDeps();
Deno.serve((req) => handleWebhook(req, deps));
