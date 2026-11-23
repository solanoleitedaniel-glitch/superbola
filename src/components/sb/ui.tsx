import type { ReactNode } from "react";
import { Beer, CupSoda, Pizza, Plus, Sandwich } from "lucide-react";
import { brl } from "@/lib/superbola/format";
import type { FlavorPrice, ProductRow, SizeRow } from "@/lib/superbola/pricing";

export const btnGold =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold px-4 text-base font-extrabold text-ink shadow-md disabled:opacity-50";
export const btnBrand =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-base font-extrabold text-cream shadow-md disabled:opacity-50";
export const card = "rounded-3xl bg-cream p-4 text-ink shadow-md";

export function CategoryIcon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const Icon = name === "cup" ? CupSoda : name === "beer" ? Beer : name === "combo" ? Sandwich : name === "plus" ? Plus : Pizza;
  return <Icon className={className} aria-hidden="true" />;
}

export function FoodArt({ src, name, icon }: { src: string; name: string; icon?: string }) {
  if (src) {
    return <img src={src} alt={name} className="h-full w-full object-cover" />;
  }
  return (
    <div className="grid h-full w-full place-items-center bg-brand text-gold">
      <CategoryIcon name={icon ?? "pizza"} className="h-8 w-8" />
      <span className="sr-only">{name}</span>
    </div>
  );
}

export function fromPrice(product: ProductRow, prices: FlavorPrice[], sizes: SizeRow[]) {
  if (product.kind !== "pizza_flavor") return product.priceCents;
  const activeSizes = new Set(sizes.filter((size) => size.active).map((size) => size.id));
  const values = prices
    .filter((price) => price.productId === product.id && activeSizes.has(price.sizeId))
    .map((price) => price.priceCents);
  return values.length ? Math.min(...values) : 0;
}

export function PriceTag({ cents, prefix }: { cents: number; prefix?: string }) {
  return (
    <span className="font-extrabold text-brand">
      {prefix ? <span className="mr-1 text-xs font-semibold text-brand-deep">{prefix}</span> : null}
      {brl(cents)}
    </span>
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return (
    <p className="mx-4 rounded-2xl bg-brand-ink/40 px-4 py-3 text-sm font-semibold leading-snug text-gold">{children}</p>
  );
}
