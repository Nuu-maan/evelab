import { getAuth, toNextJsHandler } from "@evelab/auth";

/** Better Auth's endpoints. In local mode there is no auth, so they do not exist. */
function handle(request: Request): Promise<Response> {
  const auth = getAuth();
  if (!auth) return Promise.resolve(new Response("Not found", { status: 404 }));
  return auth.handler(request);
}

export const { GET, POST } = toNextJsHandler(handle);
