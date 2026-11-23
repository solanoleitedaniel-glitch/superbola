import { createHmac, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";

function token() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() || "";
}

export function mercadoPagoConfigured() {
  return Boolean(token());
}

export async function createPixPayment(input: {
  amount: number;
  description: string;
  email: string;
  orderId: string;
  idempotency: string;
}) {
  const access = token();
  if (!access) {
    return { ok: false as const, error: "Pix online indisponível: falta MERCADO_PAGO_ACCESS_TOKEN." };
  }
  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.idempotency,
    },
    body: JSON.stringify({
      transaction_amount: input.amount,
      description: input.description,
      payment_method_id: "pix",
      external_reference: input.orderId,
      payer: { email: input.email },
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    id?: number | string;
    message?: string;
    point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
  } | null;
  const qr = body?.point_of_interaction?.transaction_data?.qr_code;
  const qrBase64 = body?.point_of_interaction?.transaction_data?.qr_code_base64;
  if (!response.ok || !body?.id || !qr) {
    return {
      ok: false as const,
      error: body?.message || "O Mercado Pago não gerou o Pix. Nenhum pedido foi marcado como pago.",
    };
  }
  return { ok: true as const, paymentId: String(body.id), qr, qrBase64: qrBase64 ?? "" };
}

function signatureOk(header: string, requestId: string, dataId: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((piece) => {
      const [key, value] = piece.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(v1);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function handleMercadoPagoWebhook(request: Request) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() || "";
  const access = token();
  if (!secret || !access) {
    return Response.json(
      {
        ok: false,
        error:
          "Webhook recusado. Defina MERCADO_PAGO_WEBHOOK_SECRET e MERCADO_PAGO_ACCESS_TOKEN. Nenhum pedido foi marcado como pago.",
      },
      { status: 503 },
    );
  }
  const payload = (await request.json().catch(() => null)) as { data?: { id?: string | number }; type?: string } | null;
  const dataId = payload?.data?.id != null ? String(payload.data.id) : "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const signature = request.headers.get("x-signature") ?? "";
  if (!dataId || !signatureOk(signature, requestId, dataId, secret)) {
    return Response.json({ ok: false, error: "Assinatura inválida." }, { status: 401 });
  }
  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const payment = (await paymentResponse.json().catch(() => null)) as {
    status?: string;
    external_reference?: string;
  } | null;
  if (!paymentResponse.ok || !payment?.external_reference) {
    return Response.json({ ok: false, error: "Pagamento não confirmado na API do Mercado Pago." }, { status: 502 });
  }
  const sql = await getSql();
  const orderId = payment.external_reference;
  await sql`insert into payment_events (id, order_id, provider, external_id, status) values (${crypto.randomUUID()}, ${orderId}, 'mercadopago', ${dataId}, ${payment.status ?? "unknown"})`;
  if (payment.status === "approved") {
    const updated = await sql<{ id: string }>`
      update orders
      set payment_status = 'pago',
          status = case when status = 'awaiting_payment' then 'received' else status end,
          updated_at = now()
      where id = ${orderId} and payment_status <> 'pago'
      returning id
    `;
    if (updated[0]) {
      await sql`insert into order_events (id, order_id, status, note, actor_id) values (${crypto.randomUUID()}, ${orderId}, 'received', 'Pix confirmado pelo Mercado Pago', 'mercadopago')`;
    }
  } else if (payment.status === "rejected" || payment.status === "cancelled") {
    await sql`
      update orders
      set payment_status = 'recusado', updated_at = now()
      where id = ${orderId} and status = 'awaiting_payment' and payment_status = 'pendente'
    `;
  }
  return Response.json({ ok: true });
}
