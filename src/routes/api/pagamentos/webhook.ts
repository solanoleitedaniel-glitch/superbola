import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/pagamentos/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMercadoPagoWebhook } = await import("@/lib/superbola/mercadopago.server");
        return handleMercadoPagoWebhook(request);
      },
    },
  },
});
