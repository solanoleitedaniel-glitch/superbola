import { createMiddleware } from "@tanstack/react-start";
import { DEMO_USER_ID } from "./demo-id";

/**
 * Acesso da demonstração comercial: qualquer visitante entra sem e-mail e senha.
 * A identidade é escolhida no servidor, nunca enviada pelo navegador.
 */
export const accessMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
  const { ensureDemoVisitor } = await import("./demo.server");
  assertSameSiteRequest();
  await ensureDemoVisitor();
  return next({ context: { userId: DEMO_USER_ID, demo: true } });
});
