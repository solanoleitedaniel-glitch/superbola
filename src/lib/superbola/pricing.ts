import type { PriceRule } from "./format";

export type SizeRow = { id: string; name: string; maxFlavors: number; active: boolean };
export type ProductRow = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  image: string;
  kind: string;
  priceCents: number;
  active: boolean;
  featured: boolean;
  badge: string;
  sort: number;
};
export type FlavorPrice = { productId: string; sizeId: string; priceCents: number };
export type NamedPrice = { id: string; name: string; priceCents: number; active: boolean };
export type CategoryRow = { id: string; name: string; slug: string; icon: string; active: boolean; sort: number };

export type CartRequestItem =
  | { kind: "simple"; productId: string; qty: number }
  | {
      kind: "pizza";
      sizeId: string;
      flavorIds: string[];
      crustId: string | null;
      extraIds: string[];
      notes?: string;
      qty: number;
    };

export type ItemMeta = {
  productId: string;
  sizeId: string;
  flavorIds: string[];
  crustId: string | null;
  extraIds: string[];
  notes: string;
};

export type PricedLine = {
  kind: "simple" | "pizza";
  name: string;
  qty: number;
  unitCents: number;
  totalCents: number;
  detail: string;
  meta: ItemMeta;
};

type CatalogSlice = {
  products: ProductRow[];
  sizes: SizeRow[];
  flavorPrices: FlavorPrice[];
  crusts: NamedPrice[];
  extras: NamedPrice[];
  rule: PriceRule;
};

export function quotePizza(
  input: {
    sizeId: string;
    flavorIds: string[];
    crustId: string | null;
    extraIds: string[];
  },
  catalog: CatalogSlice,
): { ok: true; unitCents: number; lines: string[]; flavorNames: string[]; sizeName: string } | { ok: false; error: string } {
  const size = catalog.sizes.find((item) => item.id === input.sizeId && item.active);
  if (!size) return { ok: false, error: "Tamanho indisponível." };
  const flavors = [...new Set(input.flavorIds)];
  if (flavors.length < 1) return { ok: false, error: "Escolha ao menos um sabor." };
  if (flavors.length > size.maxFlavors) {
    return { ok: false, error: `Este tamanho aceita até ${size.maxFlavors} sabor(es).` };
  }
  const cents: number[] = [];
  const flavorNames: string[] = [];
  for (const id of flavors) {
    const product = catalog.products.find((item) => item.id === id && item.active && item.kind === "pizza_flavor");
    if (!product) return { ok: false, error: "Um dos sabores não está disponível." };
    const price = catalog.flavorPrices.find((item) => item.productId === id && item.sizeId === size.id);
    if (!price) return { ok: false, error: `${product.name} não está disponível neste tamanho.` };
    cents.push(price.priceCents);
    flavorNames.push(product.name);
  }
  const base =
    catalog.rule === "average"
      ? Math.round(cents.reduce((sum, value) => sum + value, 0) / cents.length)
      : Math.max(...cents);
  const crust = catalog.crusts.find((item) => item.id === (input.crustId ?? "crust-none") && item.active);
  if (!crust && input.crustId) return { ok: false, error: "Borda indisponível." };
  const crustCents = crust?.priceCents ?? 0;
  const extraNames: string[] = [];
  let extraCents = 0;
  for (const id of [...new Set(input.extraIds)]) {
    const extra = catalog.extras.find((item) => item.id === id && item.active);
    if (!extra) return { ok: false, error: "Adicional indisponível." };
    extraNames.push(extra.name);
    extraCents += extra.priceCents;
  }
  const lines = [
    flavorNames.join(" / "),
    crust && crust.priceCents > 0 ? `Borda de ${crust.name}` : "Sem borda recheada",
    extraNames.length ? `Adicionais: ${extraNames.join(", ")}` : "",
  ].filter(Boolean);
  return { ok: true, unitCents: base + crustCents + extraCents, lines, flavorNames, sizeName: size.name };
}

export function priceItems(
  items: CartRequestItem[],
  catalog: CatalogSlice,
): { ok: true; lines: PricedLine[]; subtotalCents: number } | { ok: false; error: string } {
  if (!items.length) return { ok: false, error: "O carrinho está vazio." };
  const lines: PricedLine[] = [];
  for (const item of items) {
    const qty = item.qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      return { ok: false, error: "Quantidade inválida." };
    }
    if (item.kind === "simple") {
      const product = catalog.products.find(
        (row) => row.id === item.productId && row.active && (row.kind === "simple" || row.kind === "combo"),
      );
      if (!product) return { ok: false, error: "Um produto do carrinho não está disponível." };
      lines.push({
        kind: "simple",
        name: product.name,
        qty,
        unitCents: product.priceCents,
        totalCents: product.priceCents * qty,
        detail: product.description,
        meta: { productId: product.id, sizeId: "", flavorIds: [], crustId: null, extraIds: [], notes: "" },
      });
      continue;
    }
    const quote = quotePizza(item, catalog);
    if (!quote.ok) return quote;
    const notes = (item.notes ?? "").trim().slice(0, 240);
    lines.push({
      kind: "pizza",
      name: `Pizza ${quote.sizeName}`,
      qty,
      unitCents: quote.unitCents,
      totalCents: quote.unitCents * qty,
      detail: [...quote.lines, notes ? `Obs: ${notes}` : ""].filter(Boolean).join(" · "),
      meta: {
        productId: "",
        sizeId: item.sizeId,
        flavorIds: [...new Set(item.flavorIds)],
        crustId: item.crustId,
        extraIds: [...new Set(item.extraIds)],
        notes,
      },
    });
  }
  return { ok: true, lines, subtotalCents: lines.reduce((sum, line) => sum + line.totalCents, 0) };
}

export function couponDiscount(
  coupon: { kind: string; value: number; minCents: number } | null,
  subtotalCents: number,
): { ok: true; discountCents: number } | { ok: false; error: string } {
  if (!coupon) return { ok: true, discountCents: 0 };
  if (subtotalCents < coupon.minCents) {
    return { ok: false, error: "O cupom não atinge o pedido mínimo." };
  }
  if (coupon.kind === "percent") {
    const percent = Math.min(100, Math.max(0, coupon.value));
    return { ok: true, discountCents: Math.min(subtotalCents, Math.round((subtotalCents * percent) / 100)) };
  }
  return { ok: true, discountCents: Math.min(subtotalCents, Math.max(0, coupon.value)) };
}
