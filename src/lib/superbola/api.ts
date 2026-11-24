import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  couponDiscount,
  priceItems,
  type CartRequestItem,
  type CategoryRow,
  type FlavorPrice,
  type ItemMeta,
  type NamedPrice,
  type ProductRow,
  type SizeRow,
} from "./pricing";
import {
  fold,
  storeOpenState,
  type ForceStatus,
  type HourRow,
  type PayMethod,
  type PriceRule,
} from "./format";

type Sql = Awaited<ReturnType<(typeof import("@/lib/db"))["getSql"]>>;

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function num(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function flag(value: unknown) {
  return value === true || value === "t" || value === "true";
}

function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value == null ? "" : String(value);
}

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function record(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Dados inválidos.");
  return input as Record<string, unknown>;
}

async function requireStaff(sql: Sql, userId: string) {
  const rows = await sql<{ role: string }>`select role from staff where user_id = ${userId}`;
  if (!rows[0]) throw new Error("Acesso restrito à equipe da pizzaria.");
  return rows[0].role;
}

type Store = {
  name: string;
  phone: string;
  whatsapp: string;
  addressLine: string;
  city: string;
  state: string;
  timezone: string;
  hours: HourRow[];
  prepMinutes: number;
  pickupMinutes: number;
  minOrderCents: number;
  demoNotice: boolean;
  payments: { cash: boolean; card_delivery: boolean; pix_online: boolean; card_online: boolean };
  pixDiscountBps: number;
  priceRule: PriceRule;
  forceStatus: ForceStatus;
  joinCode?: string;
};

function mapStore(row: Record<string, unknown>, includeSecret: boolean): Store {
  const payments = asJson(row.payments, {
    cash: true,
    card_delivery: true,
    pix_online: false,
    card_online: false,
  });
  const forceRaw = str(row.force_status);
  const store: Store = {
    name: str(row.name) || "Super Bola Pizzaria",
    phone: str(row.phone),
    whatsapp: str(row.whatsapp),
    addressLine: str(row.address_line),
    city: str(row.city),
    state: str(row.state),
    timezone: str(row.timezone) || "America/Sao_Paulo",
    hours: asJson<HourRow[]>(row.hours, []),
    prepMinutes: num(row.prep_minutes),
    pickupMinutes: num(row.pickup_minutes),
    minOrderCents: num(row.min_order_cents),
    demoNotice: flag(row.demo_notice),
    payments: {
      cash: payments.cash !== false,
      card_delivery: payments.card_delivery !== false,
      pix_online: payments.pix_online === true,
      card_online: payments.card_online === true,
    },
    pixDiscountBps: num(row.pix_discount_bps),
    priceRule: row.price_rule === "average" ? "average" : "max",
    forceStatus: forceRaw === "closed" || forceRaw === "auto" ? forceRaw : "open",
  };
  if (includeSecret) store.joinCode = str(row.join_code);
  return store;
}

async function readStore(sql: Sql, includeSecret: boolean) {
  const rows = await sql<Record<string, unknown>>`select * from store_settings where id = 1`;
  if (!rows[0]) throw new Error("A pizzaria ainda não foi configurada.");
  return mapStore(rows[0], includeSecret);
}

async function readCatalog(sql: Sql, activeOnly: boolean) {
  const categories = await sql<Record<string, unknown>>`select * from categories order by sort, name`;
  const products = await sql<Record<string, unknown>>`select * from products order by sort, name`;
  const sizes = await sql<Record<string, unknown>>`select * from sizes order by sort`;
  const flavorPrices = await sql<Record<string, unknown>>`select * from flavor_prices`;
  const crusts = await sql<Record<string, unknown>>`select * from crusts order by sort`;
  const extras = await sql<Record<string, unknown>>`select * from extras order by sort`;
  const zones = await sql<Record<string, unknown>>`select * from zones order by neighborhood`;
  const mapCategory = (row: Record<string, unknown>): CategoryRow => ({
    id: str(row.id),
    name: str(row.name),
    slug: str(row.slug),
    icon: str(row.icon),
    active: flag(row.active),
    sort: num(row.sort),
  });
  const mapProduct = (row: Record<string, unknown>): ProductRow => ({
    id: str(row.id),
    categoryId: str(row.category_id),
    name: str(row.name),
    description: str(row.description),
    image: str(row.image),
    kind: str(row.kind),
    priceCents: num(row.price_cents),
    active: flag(row.active),
    featured: flag(row.featured),
    badge: str(row.badge),
    sort: num(row.sort),
  });
  const mapSize = (row: Record<string, unknown>): SizeRow => ({
    id: str(row.id),
    name: str(row.name),
    maxFlavors: num(row.max_flavors) || 1,
    active: flag(row.active),
  });
  const mapNamed = (row: Record<string, unknown>): NamedPrice => ({
    id: str(row.id),
    name: str(row.name),
    priceCents: num(row.price_cents),
    active: flag(row.active),
  });
  const mapPrice = (row: Record<string, unknown>): FlavorPrice => ({
    productId: str(row.product_id),
    sizeId: str(row.size_id),
    priceCents: num(row.price_cents),
  });
  const activeCategories = categories.map(mapCategory).filter((item) => !activeOnly || item.active);
  const activeIds = new Set(activeCategories.map((item) => item.id));
  return {
    categories: activeCategories,
    products: products
      .map(mapProduct)
      .filter((item) => (!activeOnly || item.active) && (!activeOnly || activeIds.has(item.categoryId))),
    sizes: sizes.map(mapSize).filter((item) => !activeOnly || item.active),
    flavorPrices: flavorPrices.map(mapPrice),
    crusts: crusts.map(mapNamed).filter((item) => !activeOnly || item.active),
    extras: extras.map(mapNamed).filter((item) => !activeOnly || item.active),
    zones: zones
      .map((row) => ({
        id: str(row.id),
        neighborhood: str(row.neighborhood),
        city: str(row.city),
        feeCents: num(row.fee_cents),
        etaMinutes: num(row.eta_minutes),
        active: flag(row.active),
      }))
      .filter((item) => !activeOnly || item.active),
  };
}

function itemsOf(input: Record<string, unknown>): CartRequestItem[] {
  if (!Array.isArray(input.items)) throw new Error("Carrinho inválido.");
  return input.items.map((item) => {
    const row = record(item);
    const qty = num(row.qty);
    if (row.kind === "pizza") {
      return {
        kind: "pizza" as const,
        sizeId: str(row.sizeId),
        flavorIds: Array.isArray(row.flavorIds) ? row.flavorIds.filter((id) => typeof id === "string") : [],
        crustId: typeof row.crustId === "string" ? row.crustId : null,
        extraIds: Array.isArray(row.extraIds) ? row.extraIds.filter((id) => typeof id === "string") : [],
        notes: str(row.notes),
        qty,
      };
    }
    return { kind: "simple" as const, productId: str(row.productId), qty };
  });
}

async function quoteOrder(sql: Sql, input: Record<string, unknown>) {
  const store = await readStore(sql, false);
  const catalog = await readCatalog(sql, true);
  const priced = priceItems(itemsOf(input), { ...catalog, rule: store.priceRule });
  if (!priced.ok) return { ok: false as const, error: priced.error, store, catalog };
  const mode = input.mode === "pickup" ? "pickup" : "delivery";
  let deliveryCents = 0;
  let zoneName = "";
  let etaMinutes = mode === "pickup" ? store.pickupMinutes : store.prepMinutes;
  let address: Record<string, unknown> | null = null;
  if (mode === "delivery") {
    const addressId = str(input.addressId);
    if (!addressId) return { ok: false as const, error: "Escolha um endereço de entrega.", store, catalog };
    const rows = await sql<Record<string, unknown>>`
      select * from addresses where id = ${addressId} and user_id = ${str(input.userId)}
    `;
    address = rows[0] ?? null;
    if (!address) return { ok: false as const, error: "Endereço não encontrado.", store, catalog };
    const wanted = fold(str(address.neighborhood));
    const zone = catalog.zones.find((item) => fold(item.neighborhood) === wanted);
    if (!zone) {
      const served = catalog.zones.map((item) => item.neighborhood).join(", ") || "nenhum bairro cadastrado";
      return {
        ok: false as const,
        error: `Este bairro não está na área de entrega. Atendemos: ${served}.`,
        store,
        catalog,
      };
    }
    deliveryCents = zone.feeCents;
    zoneName = zone.neighborhood;
    etaMinutes = zone.etaMinutes;
  }
  const code = str(input.couponCode).trim().toUpperCase();
  let coupon: { kind: string; value: number; minCents: number } | null = null;
  if (code) {
    const rows = await sql<Record<string, unknown>>`select * from coupons where code = ${code} and active = true`;
    if (!rows[0]) return { ok: false as const, error: "Cupom inválido.", store, catalog };
    coupon = { kind: str(rows[0].kind), value: num(rows[0].value), minCents: num(rows[0].min_cents) };
  }
  const discount = couponDiscount(coupon, priced.subtotalCents);
  if (!discount.ok) return { ok: false as const, error: discount.error, store, catalog };
  if (store.minOrderCents > 0 && priced.subtotalCents < store.minOrderCents) {
    return { ok: false as const, error: "O pedido não atingiu o mínimo da pizzaria.", store, catalog };
  }
  const totalCents = priced.subtotalCents - discount.discountCents + deliveryCents;
  return {
    ok: true as const,
    store,
    catalog,
    mode,
    lines: priced.lines,
    subtotalCents: priced.subtotalCents,
    deliveryCents,
    discountCents: discount.discountCents,
    totalCents,
    zoneName,
    etaMinutes,
    couponCode: code || null,
    address,
  };
}

function mapOrder(row: Record<string, unknown>) {
  const address = asJson<Record<string, unknown> | null>(row.address_snapshot, null);
  const rawItems = asJson<Record<string, unknown>[]>(row.items, []);
  return {
    id: str(row.id),
    number: num(row.number),
    userId: str(row.user_id),
    customerName: str(row.customer_name),
    customerPhone: str(row.customer_phone),
    mode: (row.mode === "pickup" ? "pickup" : "delivery") as "delivery" | "pickup",
    address: address
      ? {
          label: str(address.label),
          cep: str(address.cep),
          street: str(address.street),
          number: str(address.number),
          complement: str(address.complement),
          neighborhood: str(address.neighborhood),
          city: str(address.city),
          state: str(address.state),
          reference: str(address.reference),
        }
      : null,
    zoneName: str(row.zone_name),
    status: str(row.status),
    paymentMethod: str(row.payment_method),
    paymentStatus: str(row.payment_status),
    changeForCents: row.change_for_cents == null ? null : num(row.change_for_cents),
    subtotalCents: num(row.subtotal_cents),
    deliveryCents: num(row.delivery_cents),
    discountCents: num(row.discount_cents),
    totalCents: num(row.total_cents),
    couponCode: str(row.coupon_code),
    notes: str(row.notes),
    etaAt: iso(row.eta_at),
    pixQr: str(row.pix_qr),
    pixQrBase64: str(row.pix_qr_base64),
    items: rawItems.map((item) => {
      const meta = asJson<Record<string, unknown>>(item.meta, {});
      const clean: ItemMeta = {
        productId: str(meta.productId),
        sizeId: str(meta.sizeId),
        flavorIds: Array.isArray(meta.flavorIds) ? meta.flavorIds.filter((id): id is string => typeof id === "string") : [],
        crustId: typeof meta.crustId === "string" ? meta.crustId : null,
        extraIds: Array.isArray(meta.extraIds) ? meta.extraIds.filter((id): id is string => typeof id === "string") : [],
        notes: str(meta.notes),
      };
      return {
        name: str(item.name),
        qty: num(item.qty),
        unitCents: num(item.unitCents),
        totalCents: num(item.totalCents),
        detail: str(item.detail),
        kind: str(item.kind),
        meta: clean,
      };
    }),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const users = await sql<{ name: string; email: string }>`select name, email from "user" where id = ${context.userId}`;
    const name = users[0]?.name ?? "";
    await sql`insert into profiles (user_id, name, phone) values (${context.userId}, ${name}, '') on conflict (user_id) do nothing`;
    const profile = await sql<{ name: string; phone: string }>`select name, phone from profiles where user_id = ${context.userId}`;
    const staff = await sql<{ role: string }>`select role from staff where user_id = ${context.userId}`;
    const owners = await sql<{ user_id: string }>`select user_id from staff where role = 'owner' limit 1`;
    return {
      name: profile[0]?.name || name,
      email: users[0]?.email ?? "",
      phone: profile[0]?.phone ?? "",
      role: staff[0]?.role ?? null,
      storeClaimed: Boolean(owners[0]),
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const name = str(data.name).trim().slice(0, 80);
    const phone = str(data.phone).trim().slice(0, 20);
    if (name.length < 2) throw new Error("Informe seu nome.");
    const sql = await db();
    await sql`
      insert into profiles (user_id, name, phone) values (${context.userId}, ${name}, ${phone})
      on conflict (user_id) do update set name = ${name}, phone = ${phone}
    `;
    return { ok: true };
  });

export const claimStore = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const owners = await sql<{ user_id: string }>`select user_id from staff where role = 'owner' limit 1`;
    if (owners[0] && owners[0].user_id !== context.userId) {
      throw new Error("A pizzaria já tem um proprietário.");
    }
    if (!owners[0]) {
      await sql`insert into staff (user_id, role) values (${context.userId}, 'owner') on conflict (user_id) do update set role = 'owner'`;
    }
    return { ok: true };
  });

export const joinStaff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const store = await readStore(sql, true);
    if (str(data.code).trim() !== store.joinCode) throw new Error("Código da equipe incorreto.");
    await sql`insert into staff (user_id, role) values (${context.userId}, 'staff') on conflict (user_id) do nothing`;
    return { ok: true };
  });

export const listAddresses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select * from addresses where user_id = ${context.userId} order by created_at desc
    `;
    return rows.map((row) => ({
      id: str(row.id),
      label: str(row.label),
      cep: str(row.cep),
      street: str(row.street),
      number: str(row.number),
      complement: str(row.complement),
      neighborhood: str(row.neighborhood),
      city: str(row.city),
      state: str(row.state),
      reference: str(row.reference),
    }));
  });

export const saveAddress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const street = str(data.street).trim();
    const number = str(data.number).trim();
    const neighborhood = str(data.neighborhood).trim();
    const city = str(data.city).trim();
    const state = str(data.state).trim().toUpperCase();
    if (!street || !number || !neighborhood || !city || state.length !== 2) {
      throw new Error("Preencha rua, número, bairro, cidade e UF.");
    }
    const id = str(data.id) || crypto.randomUUID();
    const sql = await db();
    const owned = await sql`select id from addresses where id = ${id} and user_id = ${context.userId}`;
    const fields = {
      label: str(data.label).trim() || "Casa",
      cep: str(data.cep).replace(/\D/g, "").slice(0, 8),
      street,
      number,
      complement: str(data.complement).trim(),
      neighborhood,
      city,
      state,
      reference: str(data.reference).trim(),
    };
    if (owned[0]) {
      await sql`
        update addresses set label = ${fields.label}, cep = ${fields.cep}, street = ${fields.street},
          number = ${fields.number}, complement = ${fields.complement}, neighborhood = ${fields.neighborhood},
          city = ${fields.city}, state = ${fields.state}, reference = ${fields.reference}
        where id = ${id} and user_id = ${context.userId}
      `;
    } else {
      await sql`
        insert into addresses (id, user_id, label, cep, street, number, complement, neighborhood, city, state, reference)
        values (${id}, ${context.userId}, ${fields.label}, ${fields.cep}, ${fields.street}, ${fields.number},
          ${fields.complement}, ${fields.neighborhood}, ${fields.city}, ${fields.state}, ${fields.reference})
      `;
    }
    return { id };
  });

export const deleteAddress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await sql`delete from addresses where id = ${str(data.id)} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const getCatalog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await db();
    const store = await readStore(sql, false);
    const catalog = await readCatalog(sql, true);
    const coupons = await sql<Record<string, unknown>>`select code, kind, value, min_cents from coupons where active = true`;
    const { mercadoPagoConfigured } = await import("@/lib/superbola/mercadopago.server");
    return {
      store,
      open: storeOpenState(store.hours, store.forceStatus, new Date(), store.timezone),
      ...catalog,
      coupons: coupons.map((row) => ({
        code: str(row.code),
        kind: str(row.kind),
        value: num(row.value),
        minCents: num(row.min_cents),
      })),
      pixReady: mercadoPagoConfigured() && store.payments.pix_online,
    };
  });

export const previewOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const quote = await quoteOrder(sql, { ...data, userId: context.userId });
    if (!quote.ok) return { ok: false as const, error: quote.error };
    return {
      ok: true as const,
      lines: quote.lines,
      subtotalCents: quote.subtotalCents,
      deliveryCents: quote.deliveryCents,
      discountCents: quote.discountCents,
      totalCents: quote.totalCents,
      zoneName: quote.zoneName,
      etaMinutes: quote.etaMinutes,
      open: storeOpenState(quote.store.hours, quote.store.forceStatus, new Date(), quote.store.timezone),
    };
  });

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const clientToken = str(data.clientToken);
    if (!/^[0-9a-f-]{36}$/i.test(clientToken)) throw new Error("Pedido inválido. Atualize a página.");
    const name = str(data.customerName).trim().slice(0, 80);
    const phone = str(data.customerPhone).trim().slice(0, 20);
    if (name.length < 2) throw new Error("Informe seu nome.");
    if (phone.replace(/\D/g, "").length < 10) throw new Error("Informe um telefone com DDD.");
    const method = str(data.paymentMethod) as PayMethod;
    if (!["cash", "card_delivery", "pix_online", "card_online"].includes(method)) {
      throw new Error("Forma de pagamento inválida.");
    }
    const sql = await db();
    const existing = await sql<Record<string, unknown>>`select id, user_id from orders where client_token = ${clientToken}`;
    if (existing[0]) {
      if (str(existing[0].user_id) !== context.userId) throw new Error("Este pedido não é seu.");
      return { id: str(existing[0].id), reused: true };
    }
    const quote = await quoteOrder(sql, { ...data, userId: context.userId });
    if (!quote.ok) throw new Error(quote.error);
    const open = storeOpenState(quote.store.hours, quote.store.forceStatus, new Date(), quote.store.timezone);
    if (!open.isOpen) throw new Error(`A pizzaria está fechada (${open.label}).`);
    if (!quote.store.payments[method]) throw new Error("Essa forma de pagamento está desativada.");
    const changeFor = data.changeForCents == null || data.changeForCents === "" ? null : num(data.changeForCents);
    if (method === "cash" && changeFor != null && changeFor < quote.totalCents) {
      throw new Error("O valor para troco precisa cobrir o total.");
    }
    if (method === "card_online") {
      throw new Error("Cartão online ainda não está ativo. Falta a credencial do Mercado Pago. Escolha pagamento na entrega.");
    }
    const id = crypto.randomUUID();
    let paymentStatus = method === "cash" || method === "card_delivery" ? "na_entrega" : "pendente";
    let status = "received";
    let pixQr = "";
    let pixQrBase64 = "";
    let pixPaymentId = "";
    if (method === "pix_online") {
      const { createPixPayment, mercadoPagoConfigured } = await import("@/lib/superbola/mercadopago.server");
      if (!mercadoPagoConfigured()) {
        throw new Error("Pix online ainda não está ativo. Configure o Mercado Pago ou escolha pagamento na entrega.");
      }
      const users = await sql<{ email: string }>`select email from "user" where id = ${context.userId}`;
      const pix = await createPixPayment({
        amount: Number((quote.totalCents / 100).toFixed(2)),
        description: `Super Bola Pizzaria ${id.slice(0, 8)}`,
        email: users[0]?.email || "cliente@superbola.invalid",
        orderId: id,
        idempotency: clientToken,
      });
      if (!pix.ok) throw new Error(pix.error);
      paymentStatus = "pendente";
      status = "awaiting_payment";
      pixQr = pix.qr;
      pixQrBase64 = pix.qrBase64;
      pixPaymentId = pix.paymentId;
    }
    const eta = new Date(Date.now() + quote.etaMinutes * 60_000).toISOString();
    const addressJson = quote.address
      ? JSON.stringify({
          label: str(quote.address.label),
          cep: str(quote.address.cep),
          street: str(quote.address.street),
          number: str(quote.address.number),
          complement: str(quote.address.complement),
          neighborhood: str(quote.address.neighborhood),
          city: str(quote.address.city),
          state: str(quote.address.state),
          reference: str(quote.address.reference),
        })
      : null;
    await sql`
      update profiles set name = ${name}, phone = ${phone} where user_id = ${context.userId}
    `;
    await sql`
      insert into orders (
        id, number, user_id, client_token, customer_name, customer_phone, mode, address_snapshot, zone_name,
        status, payment_method, payment_status, change_for_cents, subtotal_cents, delivery_cents, discount_cents,
        total_cents, coupon_code, notes, eta_at, pix_qr, pix_qr_base64, pix_payment_id, items
      ) values (
        ${id}, nextval('order_number_seq'), ${context.userId}, ${clientToken}, ${name}, ${phone}, ${quote.mode},
        ${addressJson}::jsonb, ${quote.zoneName}, ${status}, ${method}, ${paymentStatus}, ${changeFor},
        ${quote.subtotalCents}, ${quote.deliveryCents}, ${quote.discountCents}, ${quote.totalCents},
        ${quote.couponCode}, ${str(data.notes).trim().slice(0, 240)}, ${eta}, ${pixQr}, ${pixQrBase64},
        ${pixPaymentId}, ${JSON.stringify(quote.lines)}::jsonb
      )
    `;
    await sql`
      insert into order_events (id, order_id, status, note, actor_id)
      values (${crypto.randomUUID()}, ${id}, ${status}, '', ${context.userId})
    `;
    const created = await sql<{ number: number }>`select number from orders where id = ${id}`;
    return { id, number: num(created[0]?.number), reused: false };
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`
      select * from orders where user_id = ${context.userId} order by created_at desc limit 40
    `;
    return rows.map(mapOrder);
  });

export const getOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const rows = await sql<Record<string, unknown>>`select * from orders where id = ${str(data.id)}`;
    if (!rows[0]) throw new Error("Pedido não encontrado.");
    if (str(rows[0].user_id) !== context.userId) await requireStaff(sql, context.userId);
    const events = await sql<Record<string, unknown>>`
      select status, note, created_at from order_events where order_id = ${str(data.id)} order by created_at
    `;
    return {
      order: mapOrder(rows[0]),
      events: events.map((row) => ({ status: str(row.status), note: str(row.note), at: iso(row.created_at) })),
    };
  });

export const cancelMyOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    const rows = await sql<{ id: string }>`
      update orders set status = 'cancelled', updated_at = now()
      where id = ${str(data.id)} and user_id = ${context.userId} and status in ('received', 'awaiting_payment')
      returning id
    `;
    if (!rows[0]) throw new Error("Este pedido já está em preparo e não pode ser cancelado por aqui.");
    await sql`
      insert into order_events (id, order_id, status, note, actor_id)
      values (${crypto.randomUUID()}, ${str(data.id)}, 'cancelled', 'Cancelado pelo cliente', ${context.userId})
    `;
    return { ok: true };
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const rows = await sql<Record<string, unknown>>`select * from orders order by created_at desc limit 80`;
    return rows.map(mapOrder);
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const next = str(data.status);
    const note = str(data.note).trim().slice(0, 240);
    const rows = await sql<Record<string, unknown>>`select * from orders where id = ${str(data.id)}`;
    if (!rows[0]) throw new Error("Pedido não encontrado.");
    const current = str(rows[0].status);
    const mode = str(rows[0].mode) === "pickup" ? "pickup" : "delivery";
    const allowed =
      current === "received"
        ? ["accepted", "refused"]
        : current === "accepted"
          ? ["preparing", "cancelled"]
          : current === "preparing"
            ? ["oven", "cancelled"]
            : current === "oven"
              ? ["ready", "cancelled"]
              : current === "ready"
                ? mode === "delivery"
                  ? ["out_for_delivery", "cancelled"]
                  : ["picked_up", "cancelled"]
                : current === "out_for_delivery"
                  ? ["delivered", "cancelled"]
                  : [];
    if (!allowed.includes(next)) throw new Error("Essa mudança de status não é permitida.");
    if ((next === "refused" || next === "cancelled") && note.length < 3) {
      throw new Error("Informe o motivo.");
    }
    const payNow = next === "delivered" || next === "picked_up";
    await sql`
      update orders set status = ${next}, updated_at = now(),
        payment_status = case when ${payNow} and payment_status = 'na_entrega' then 'pago' else payment_status end
      where id = ${str(data.id)}
    `;
    await sql`
      insert into order_events (id, order_id, status, note, actor_id)
      values (${crypto.randomUUID()}, ${str(data.id)}, ${next}, ${note}, ${context.userId})
    `;
    return { ok: true };
  });

export const getAdminBundle = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const store = await readStore(sql, true);
    const catalog = await readCatalog(sql, false);
    const { mercadoPagoConfigured } = await import("@/lib/superbola/mercadopago.server");
    return { store, ...catalog, pixConfigured: mercadoPagoConfigured() };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const hours = Array.isArray(data.hours) ? data.hours : [];
    const cleanHours: HourRow[] = hours.slice(0, 7).map((item, index) => {
      const row = record(item);
      return {
        day: index,
        open: /^\d{2}:\d{2}$/.test(str(row.open)) ? str(row.open) : "11:00",
        close: /^\d{2}:\d{2}$/.test(str(row.close)) ? str(row.close) : "23:00",
        closed: flag(row.closed),
      };
    });
    const payments = record(data.payments ?? {});
    const force = str(data.forceStatus);
    const rule = str(data.priceRule) === "average" ? "average" : "max";
    const pixWanted = flag(payments.pix_online);
    const { mercadoPagoConfigured } = await import("@/lib/superbola/mercadopago.server");
    if (pixWanted && !mercadoPagoConfigured()) {
      throw new Error("Não dá para ativar Pix sem MERCADO_PAGO_ACCESS_TOKEN no servidor.");
    }
    await sql`
      update store_settings set
        phone = ${str(data.phone).trim().slice(0, 20)},
        whatsapp = ${str(data.whatsapp).trim().slice(0, 20)},
        address_line = ${str(data.addressLine).trim().slice(0, 120)},
        city = ${str(data.city).trim().slice(0, 60)},
        state = ${str(data.state).trim().slice(0, 2).toUpperCase()},
        prep_minutes = ${Math.min(180, Math.max(5, num(data.prepMinutes)))},
        pickup_minutes = ${Math.min(180, Math.max(5, num(data.pickupMinutes)))},
        min_order_cents = ${Math.max(0, num(data.minOrderCents))},
        payments = ${JSON.stringify({
          cash: payments.cash !== false,
          card_delivery: payments.card_delivery !== false,
          pix_online: pixWanted,
          card_online: false,
        })}::jsonb,
        price_rule = ${rule},
        force_status = ${force === "auto" || force === "closed" || force === "open" ? force : "auto"},
        hours = ${JSON.stringify(cleanHours)}::jsonb,
        join_code = ${str(data.joinCode).trim().slice(0, 40) || "EQUIPE-BOLA"},
        demo_notice = ${flag(data.demoNotice)},
        updated_at = now()
      where id = 1
    `;
    return { ok: true };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const id = str(data.id);
    const name = str(data.name).trim().slice(0, 80);
    if (!id || name.length < 2) throw new Error("Nome inválido.");
    await sql`
      update products set
        name = ${name},
        description = ${str(data.description).trim().slice(0, 240)},
        price_cents = ${Math.max(0, num(data.priceCents))},
        active = ${flag(data.active)},
        featured = ${flag(data.featured)},
        badge = ${str(data.badge).trim().slice(0, 24)}
      where id = ${id}
    `;
    return { ok: true };
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const name = str(data.name).trim().slice(0, 80);
    const categoryId = str(data.categoryId);
    const kind = str(data.kind) === "pizza_flavor" ? "pizza_flavor" : str(data.kind) === "combo" ? "combo" : "simple";
    if (name.length < 2 || !categoryId) throw new Error("Informe nome e categoria.");
    const id = `item-${crypto.randomUUID().slice(0, 8)}`;
    const price = Math.max(0, num(data.priceCents));
    await sql`
      insert into products (id, category_id, name, description, image, kind, price_cents, active, featured, sort, badge)
      values (${id}, ${categoryId}, ${name}, ${str(data.description).trim().slice(0, 240)}, '', ${kind}, ${kind === "pizza_flavor" ? 0 : price}, true, false, 50, '')
    `;
    if (kind === "pizza_flavor") {
      const sizes = await sql<{ id: string }>`select id from sizes where active = true`;
      for (const size of sizes) {
        await sql`
          insert into flavor_prices (product_id, size_id, price_cents) values (${id}, ${size.id}, ${price})
          on conflict (product_id, size_id) do update set price_cents = ${price}
        `;
      }
    }
    return { id };
  });

export const saveFlavorPrice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const productId = str(data.productId);
    const sizeId = str(data.sizeId);
    const price = Math.max(0, num(data.priceCents));
    await sql`
      insert into flavor_prices (product_id, size_id, price_cents) values (${productId}, ${sizeId}, ${price})
      on conflict (product_id, size_id) do update set price_cents = ${price}
    `;
    return { ok: true };
  });

export const saveNamedOption = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const table = str(data.table) === "extras" ? "extras" : str(data.table) === "crusts" ? "crusts" : "";
    if (!table) throw new Error("Opção inválida.");
    const id = str(data.id);
    const name = str(data.name).trim().slice(0, 40);
    const price = Math.max(0, num(data.priceCents));
    if (id) {
      if (table === "extras") {
        await sql`update extras set name = ${name}, price_cents = ${price}, active = ${flag(data.active)} where id = ${id}`;
      } else {
        await sql`update crusts set name = ${name}, price_cents = ${price}, active = ${flag(data.active)} where id = ${id}`;
      }
      return { id };
    }
    const created = `opt-${crypto.randomUUID().slice(0, 8)}`;
    if (table === "extras") {
      await sql`insert into extras (id, name, price_cents, active, sort) values (${created}, ${name}, ${price}, true, 20)`;
    } else {
      await sql`insert into crusts (id, name, price_cents, active, sort) values (${created}, ${name}, ${price}, true, 20)`;
    }
    return { id: created };
  });

export const saveSize = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    await sql`
      update sizes set name = ${str(data.name).trim().slice(0, 24)}, max_flavors = ${Math.min(4, Math.max(1, num(data.maxFlavors)))}, active = ${flag(data.active)}
      where id = ${str(data.id)}
    `;
    return { ok: true };
  });

export const saveZone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const neighborhood = str(data.neighborhood).trim().slice(0, 60);
    if (neighborhood.length < 2) throw new Error("Informe o bairro.");
    const id = str(data.id) || `zone-${crypto.randomUUID().slice(0, 8)}`;
    const fee = Math.max(0, num(data.feeCents));
    const eta = Math.min(180, Math.max(10, num(data.etaMinutes) || 40));
    const existing = await sql`select id from zones where id = ${id}`;
    if (existing[0]) {
      await sql`
        update zones set neighborhood = ${neighborhood}, city = ${str(data.city).trim().slice(0, 60)},
          fee_cents = ${fee}, eta_minutes = ${eta}, active = ${flag(data.active)}
        where id = ${id}
      `;
    } else {
      await sql`
        insert into zones (id, neighborhood, city, fee_cents, eta_minutes, active)
        values (${id}, ${neighborhood}, ${str(data.city).trim().slice(0, 60)}, ${fee}, ${eta}, true)
      `;
    }
    return { id };
  });

export const deleteZone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    await sql`delete from zones where id = ${str(data.id)}`;
    return { ok: true };
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const name = str(data.name).trim().slice(0, 40);
    if (name.length < 2) throw new Error("Nome da categoria inválido.");
    const id = str(data.id);
    if (id) {
      await sql`update categories set name = ${name}, active = ${flag(data.active)} where id = ${id}`;
      return { id };
    }
    const created = `cat-${crypto.randomUUID().slice(0, 8)}`;
    const slug = fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || created;
    await sql`insert into categories (id, name, slug, icon, sort, active) values (${created}, ${name}, ${slug}, 'plus', 20, true)`;
    return { id: created };
  });

export const getReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => record(input))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await requireStaff(sql, context.userId);
    const days = data.days === 30 || data.days === 90 ? data.days : 7;
    const rows = await sql<Record<string, unknown>>`
      select * from orders where created_at >= now() - (${days} * interval '1 day')
    `;
    const orders = rows.map(mapOrder);
    const done = orders.filter((order) => order.paymentStatus === "pago");
    const revenue = done.reduce((sum, order) => sum + order.totalCents, 0);
    const cancelled = orders.filter((order) => order.status === "cancelled" || order.status === "refused").length;
    const byPayment = new Map<string, { count: number; totalCents: number }>();
    for (const order of orders) {
      const bucket = byPayment.get(order.paymentMethod) ?? { count: 0, totalCents: 0 };
      bucket.count += 1;
      if (order.paymentStatus === "pago") bucket.totalCents += order.totalCents;
      byPayment.set(order.paymentMethod, bucket);
    }
    const products = new Map<string, { qty: number; totalCents: number }>();
    for (const order of orders) {
      if (order.status === "cancelled" || order.status === "refused") continue;
      for (const item of order.items) {
        const bucket = products.get(item.name) ?? { qty: 0, totalCents: 0 };
        bucket.qty += item.qty;
        bucket.totalCents += item.totalCents;
        products.set(item.name, bucket);
      }
    }
    return {
      days,
      count: orders.length,
      cancelled,
      revenueCents: revenue,
      avgTicketCents: done.length ? Math.round(revenue / done.length) : 0,
      byPayment: [...byPayment.entries()].map(([method, bucket]) => ({ method, ...bucket })),
      top: [...products.entries()]
        .map(([name, bucket]) => ({ name, ...bucket }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8),
    };
  });
