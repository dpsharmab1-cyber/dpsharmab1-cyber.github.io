import { handleCreateOrder } from '../_shared/handlers.ts';
import { makeDeps } from '../_shared/deps.ts';

const deps = makeDeps();
Deno.serve((req) => handleCreateOrder(req, deps));
