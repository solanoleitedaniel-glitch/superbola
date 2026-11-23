export type HourRow = { day: number; open: string; close: string; closed: boolean };
export type ForceStatus = "auto" | "open" | "closed";
export type PriceRule = "max" | "average";
export type PayMethod = "cash" | "card_delivery" | "pix_online" | "card_online";

export const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  received: "Pedido recebido",
  accepted: "Pedido aceito",
  preparing: "Em preparo",
  oven: "No forno",
  ready: "Pronto",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  picked_up: "Retirado",
  cancelled: "Cancelado",
  refused: "Recusado",
};

export const PAY_LABEL: Record<string, string> = {
  cash: "Dinheiro na entrega",
  card_delivery: "Cartão na entrega",
  pix_online: "Pix",
  card_online: "Cartão online",
};

export const PAY_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  na_entrega: "Pagar na entrega",
  recusado: "Recusado",
};

export function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function parseReais(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

export function reaisInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatWhen(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function storeOpenState(
  hours: HourRow[],
  force: ForceStatus,
  now = new Date(),
  tz = "America/Sao_Paulo",
) {
  if (force === "open") return { isOpen: true, label: "Aberto agora", manual: true };
  if (force === "closed") return { isOpen: false, label: "Fechado", manual: true };
  if (!hours.length) return { isOpen: false, label: "Horário não configurado", manual: false };
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = map[weekday] ?? 0;
  const mins =
    Number(parts.find((part) => part.type === "hour")?.value ?? "0") * 60 +
    Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const row = hours.find((item) => item.day === day);
  if (!row || row.closed) return { isOpen: false, label: "Fechado hoje", manual: false };
  const [oh, om] = row.open.split(":").map(Number);
  const [ch, cm] = row.close.split(":").map(Number);
  const start = oh * 60 + om;
  const end = ch * 60 + cm;
  const open = end > start ? mins >= start && mins <= end : mins >= start || mins <= end;
  return {
    isOpen: open,
    label: open ? `Aberto até ${row.close}` : "Fechado agora",
    manual: false,
  };
}

export function deliverySteps(mode: "delivery" | "pickup") {
  const base = ["received", "accepted", "preparing", "oven", "ready"];
  return mode === "delivery" ? [...base, "out_for_delivery", "delivered"] : [...base, "picked_up"];
}

export function nextStatuses(status: string, mode: "delivery" | "pickup") {
  if (status === "received") return ["accepted", "refused"];
  if (status === "accepted") return ["preparing", "cancelled"];
  if (status === "preparing") return ["oven", "cancelled"];
  if (status === "oven") return ["ready", "cancelled"];
  if (status === "ready") return mode === "delivery" ? ["out_for_delivery", "cancelled"] : ["picked_up", "cancelled"];
  if (status === "out_for_delivery") return ["delivered", "cancelled"];
  return [];
}

export function errorText(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error && typeof error.message === "string"
        ? error.message
        : "";
  if (!message || message === "Unauthorized") return "Entre na sua conta para continuar.";
  return message;
}
