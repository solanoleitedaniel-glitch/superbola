import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Bike, Menu, Minus, Plus, ShoppingCart, Store, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "./frame";
import { Banner, CategoryIcon, FoodArt, PriceTag, btnBrand, btnGold, card, fromPrice } from "./ui";
import { cartCount, useCart } from "@/lib/superbola/cart";
import { brl } from "@/lib/superbola/format";
import { quotePizza } from "@/lib/superbola/pricing";

export function HomePage() {
  const { me, catalog } = useSession();
  const navigate = useNavigate();
  const lines = useCart((state) => state.lines);
  const count = cartCount(lines);
  const first = me?.demo || !me?.name ? "" : me.name.split(" ")[0];
  const grande = catalog?.flavorPrices.filter((price) => price.sizeId === "size-g").map((price) => price.priceCents) ?? [];
  const from = grande.length ? Math.min(...grande) : 0;
  const hero = catalog?.products.find((product) => product.image)?.image || "/menu/calabresa.jpg";

  function choose(mode: "delivery" | "pickup") {
    useCart.getState().setMode(mode);
    void navigate({ to: "/cardapio", search: { cat: "pizzas", q: "" } });
  }

  if (!catalog) return null;
  return (
    <main>
      <header className="flex items-center justify-between px-4 pt-4">
        <Link to="/conta" aria-label="Conta" className="grid h-11 w-11 place-items-center rounded-2xl bg-brand">
          <Menu className="h-5 w-5" />
        </Link>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${catalog.open.isOpen ? "bg-ok text-cream" : "bg-ink text-cream"}`}>
          {catalog.open.label}
        </span>
        <div className="flex gap-2">
          <Link to="/conta" aria-label="Perfil" className="grid h-11 w-11 place-items-center rounded-2xl bg-brand">
            <UserRound className="h-5 w-5" />
          </Link>
          <Link to="/carrinho" aria-label="Carrinho" className="relative grid h-11 w-11 place-items-center rounded-2xl bg-brand">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-extrabold text-ink">
                {count}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      <img src="/brand/mascote.png" alt="Super Bola Pizzaria" className="mx-auto mt-2 h-44 w-44 rounded-3xl object-cover shadow-lg" />

      <section className="px-4 pt-4">
        <h1 className="text-4xl font-extrabold text-gold">Olá{first ? `, ${first}` : ""}!</h1>
        <p className="mt-2 max-w-xs text-base font-semibold leading-snug">
          Faça seu pedido e aproveite as delícias da Super Bola.
        </p>
      </section>

      <img src={hero} alt="Pizza recém-saída do forno" className="mt-4 h-52 w-full object-cover" />

      {catalog.store.demoNotice ? (
        <div className="mt-4">
          <Banner>
            Cardápio de demonstração. Preços, bairros e taxas não são comerciais — o dono ajusta tudo no painel.
          </Banner>
        </div>
      ) : null}
      {catalog.open.manual ? (
        <p className="px-4 pt-3 text-sm font-semibold text-gold">Abertura manual ligada. O horário real está nos ajustes da loja.</p>
      ) : null}

      <Link to="/admin" className="mx-4 mt-4 flex h-12 items-center justify-center rounded-2xl bg-gold text-sm font-extrabold text-ink">
        Sou o dono — ver o painel da pizzaria
      </Link>
      <div className="no-scroll mt-4 flex gap-3 overflow-x-auto px-4">
        {catalog.categories.map((category) => (
          <Link
            key={category.id}
            to="/cardapio"
            search={{ cat: category.slug, q: "" }}
            className="grid h-24 w-24 shrink-0 place-items-center rounded-3xl bg-brand text-center text-xs font-extrabold text-cream shadow-md first:bg-gold first:text-ink"
          >
            <CategoryIcon name={category.icon} />
            {category.name}
          </Link>
        ))}
      </div>

      <section className="mx-4 mt-4 overflow-hidden rounded-3xl border-2 border-gold bg-brand-ink/30">
        <div className="grid grid-cols-2 items-center">
          <div className="p-4">
            <p className="text-2xl font-extrabold leading-none">PIZZA GRANDE</p>
            <p className="mt-1 text-sm font-semibold">a partir de</p>
            <p className="mt-2 inline-block rounded-xl bg-gold px-3 py-1 text-2xl font-extrabold text-brand">{brl(from)}</p>
          </div>
          <img src={hero} alt="" className="h-36 w-full object-cover" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <button type="button" className={btnBrand} onClick={() => choose("delivery")}>
          <Bike className="h-5 w-5" /> Pedir entrega
        </button>
        <button type="button" className={btnGold} onClick={() => choose("pickup")}>
          <Store className="h-5 w-5" /> Retirar na loja
        </button>
      </div>
    </main>
  );
}

export function MenuPage() {
  const { catalog } = useSession();
  const search = useSearch({ from: "/cardapio" });
  const navigate = useNavigate();
  if (!catalog) return null;
  const category = catalog.categories.find((item) => item.slug === search.cat) ?? catalog.categories[0];
  const query = search.q.trim().toLocaleLowerCase("pt-BR");
  const products = catalog.products.filter((product) => {
    const inCategory = !query && category ? product.categoryId === category.id : true;
    const matches = !query || `${product.name} ${product.description}`.toLocaleLowerCase("pt-BR").includes(query);
    return inCategory && matches;
  });

  return (
    <main>
      <header className="flex items-center gap-3 px-4 pt-4">
        <Link to="/" className="text-sm font-extrabold text-gold">Início</Link>
        <h1 className="flex-1 text-center text-lg font-extrabold">Cardápio</h1>
        <Link to="/carrinho" className="text-sm font-extrabold text-gold">Carrinho</Link>
      </header>
      <label className="mx-4 mt-4 block">
        <span className="sr-only">Buscar</span>
        <input
          value={search.q}
          onChange={(event) => void navigate({ to: "/cardapio", search: { cat: search.cat, q: event.target.value } })}
          placeholder="Buscar sabor, bebida, combo"
          className="h-12 w-full rounded-2xl bg-cream px-4 font-semibold text-ink"
        />
      </label>
      <div className="no-scroll mt-3 flex gap-2 overflow-x-auto px-4">
        {catalog.categories.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void navigate({ to: "/cardapio", search: { cat: item.slug, q: "" } })}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-extrabold ${item.slug === category?.slug && !query ? "bg-gold text-ink" : "bg-brand text-cream"}`}
          >
            {item.name}
          </button>
        ))}
      </div>
      <ul className="space-y-3 px-4 py-4">
        {products.length === 0 ? <li className={`${card} text-center font-semibold`}>Nada encontrado nessa busca.</li> : null}
        {products.map((product) => {
          const price = fromPrice(product, catalog.flavorPrices, catalog.sizes);
          const pizza = product.kind === "pizza_flavor";
          return (
            <li key={product.id} className={`${card} flex gap-3`}>
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
                <FoodArt src={product.image} name={product.name} icon={pizza ? "pizza" : "cup"} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-extrabold">{product.name}</h2>
                  {product.badge ? <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-extrabold text-ink">{product.badge}</span> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-brand-deep">{product.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <PriceTag cents={price} prefix={pizza ? "a partir de" : undefined} />
                  {pizza ? (
                    <Link to="/montar/$id" params={{ id: product.id }} className="grid h-11 w-11 place-items-center rounded-full bg-gold text-ink" aria-label={`Montar ${product.name}`}>
                      <Plus className="h-5 w-5" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="grid h-11 w-11 place-items-center rounded-full bg-gold text-ink"
                      aria-label={`Adicionar ${product.name}`}
                      onClick={() => {
                        useCart.getState().add({
                          title: product.name,
                          subtitle: product.description,
                          unitCents: product.priceCents,
                          request: { kind: "simple", productId: product.id, qty: 1 },
                        });
                        toast.success(`${product.name} no carrinho`);
                      }}
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

export function BuilderPage() {
  const { id } = useParams({ from: "/montar/$id" });
  const { catalog } = useSession();
  const navigate = useNavigate();
  const [sizeId, setSizeId] = useState("size-m");
  const [flavors, setFlavors] = useState<string[]>(id === "nova" ? [] : [id]);
  const [crustId, setCrustId] = useState("crust-none");
  const [extras, setExtras] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState(0);

  const quote = useMemo(() => {
    if (!catalog) return null;
    return quotePizza({ sizeId, flavorIds: flavors, crustId, extraIds: extras }, { ...catalog, rule: catalog.store.priceRule });
  }, [catalog, sizeId, flavors, crustId, extras]);

  if (!catalog) return null;
  const size = catalog.sizes.find((item) => item.id === sizeId);
  const flavorsCatalog = catalog.products.filter((product) => product.kind === "pizza_flavor");
  const ruleLabel = catalog.store.priceRule === "average" ? "média dos sabores" : "sabor mais caro";

  function toggleFlavor(flavorId: string) {
    setFlavors((current) => {
      if (current.includes(flavorId)) return current.filter((item) => item !== flavorId);
      const max = size?.maxFlavors ?? 1;
      if (current.length >= max) {
        toast.error(`Este tamanho aceita até ${max} sabor(es).`);
        return current;
      }
      return [...current, flavorId];
    });
  }

  function add() {
    if (!quote || !quote.ok || !size) {
      toast.error(quote && !quote.ok ? quote.error : "Confira a pizza.");
      return;
    }
    useCart.getState().add({
      title: `Pizza ${quote.sizeName}`,
      subtitle: [...quote.lines, notes.trim() ? `Obs: ${notes.trim()}` : ""].filter(Boolean).join(" · "),
      unitCents: quote.unitCents,
      request: { kind: "pizza", sizeId, flavorIds: flavors, crustId, extraIds: extras, notes: notes.trim(), qty },
    });
    toast.success("Pizza no carrinho");
    void navigate({ to: "/carrinho" });
  }

  const steps = ["Tamanho", "Sabores", "Borda", "Extras"];
  return (
    <main className="pb-28">
      <header className="flex items-center gap-3 px-4 pt-4">
        <button type="button" className="text-sm font-extrabold text-gold" onClick={() => (step === 0 ? navigate({ to: "/cardapio", search: { cat: "pizzas", q: "" } }) : setStep((value) => value - 1))}>
          Voltar
        </button>
        <h1 className="flex-1 text-center text-lg font-extrabold">Monte sua pizza</h1>
        <span className="text-sm font-extrabold text-gold">{steps[step]}</span>
      </header>
      <p className="px-4 pt-2 text-sm font-semibold text-gold">Cobrança configurada: {ruleLabel}.</p>
      <ol className="mt-3 grid grid-cols-4 gap-2 px-4">
        {steps.map((label, index) => (
          <li key={label}>
            <button type="button" onClick={() => setStep(index)} className={`h-10 w-full rounded-full text-xs font-extrabold ${index === step ? "bg-gold text-ink" : "bg-brand text-cream"}`}>
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          {catalog.sizes.map((item) => {
            const values = catalog.flavorPrices.filter((price) => price.sizeId === item.id).map((price) => price.priceCents);
            const min = values.length ? Math.min(...values) : 0;
            return (
              <button key={item.id} type="button" onClick={() => setSizeId(item.id)} className={`rounded-3xl p-4 text-left ${item.id === sizeId ? "bg-gold text-ink" : "bg-cream text-ink"}`}>
                <span className="block text-lg font-extrabold">{item.name}</span>
                <span className="mt-1 block text-sm font-semibold">até {item.maxFlavors} sabor(es)</span>
                <span className="mt-2 block text-sm font-extrabold">a partir de {brl(min)}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {step === 1 ? (
        <ul className="space-y-2 px-4 py-4">
          {flavorsCatalog.map((product) => {
            const price = catalog.flavorPrices.find((item) => item.productId === product.id && item.sizeId === sizeId);
            const on = flavors.includes(product.id);
            return (
              <li key={product.id}>
                <button type="button" onClick={() => toggleFlavor(product.id)} className={`${card} flex w-full items-center gap-3 text-left ${on ? "ring-4 ring-gold" : ""}`}>
                  <div className="h-14 w-14 overflow-hidden rounded-2xl">
                    <FoodArt src={product.image} name="" icon="pizza" />
                  </div>
                  <span className="flex-1">
                    <span className="block font-extrabold">{product.name}</span>
                    <span className="block text-sm font-medium text-brand-deep">{product.description}</span>
                  </span>
                  <span className="font-extrabold">{price ? brl(price.priceCents) : "—"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {step === 2 ? (
        <ul className="space-y-2 px-4 py-4">
          {catalog.crusts.map((crust) => (
            <li key={crust.id}>
              <button type="button" onClick={() => setCrustId(crust.id)} className={`${card} flex w-full items-center justify-between ${crust.id === crustId ? "ring-4 ring-gold" : ""}`}>
                <span className="font-extrabold">{crust.name}</span>
                <span className="font-extrabold">{crust.priceCents ? `+ ${brl(crust.priceCents)}` : "incluso"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3 px-4 py-4">
          <ul className="space-y-2">
            {catalog.extras.map((extra) => {
              const on = extras.includes(extra.id);
              return (
                <li key={extra.id}>
                  <button
                    type="button"
                    onClick={() => setExtras((current) => (on ? current.filter((item) => item !== extra.id) : [...current, extra.id]))}
                    className={`${card} flex w-full items-center justify-between ${on ? "ring-4 ring-gold" : ""}`}
                  >
                    <span className="font-extrabold">{extra.name}</span>
                    <span className="font-extrabold">+ {brl(extra.priceCents)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="block text-sm font-bold">
            Observações
            <textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 240))} placeholder="Ex.: sem cebola" className="mt-1 h-24 w-full rounded-2xl bg-cream p-3 font-semibold text-ink" />
          </label>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-ink bg-brand-deep">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Diminuir" className="grid h-11 w-11 place-items-center rounded-full bg-brand" onClick={() => setQty((value) => Math.max(1, value - 1))}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center font-extrabold">{qty}</span>
            <button type="button" aria-label="Aumentar" className="grid h-11 w-11 place-items-center rounded-full bg-brand" onClick={() => setQty((value) => Math.min(20, value + 1))}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {step < 3 ? (
            <button type="button" className={btnGold} onClick={() => setStep((value) => value + 1)}>Continuar</button>
          ) : (
            <button type="button" className={btnGold} onClick={add}>
              Adicionar {quote?.ok ? brl(quote.unitCents * qty) : ""}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export function ProductPage() {
  const { id } = useParams({ from: "/produto/$id" });
  const { catalog } = useSession();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const product = catalog?.products.find((item) => item.id === id);
  if (!catalog || !product || product.kind === "pizza_flavor") {
    return (
      <main className="px-4 py-8">
        <p className="font-extrabold">Produto indisponível.</p>
        <Link to="/cardapio" search={{ cat: "pizzas", q: "" }} className="mt-4 inline-block font-extrabold text-gold">Voltar ao cardápio</Link>
      </main>
    );
  }
  return (
    <main className="pb-28">
      <div className="h-56 overflow-hidden">
        <FoodArt src={product.image} name={product.name} icon="cup" />
      </div>
      <div className="px-4 py-4">
        <h1 className="text-2xl font-extrabold">{product.name}</h1>
        <p className="mt-2 font-medium leading-relaxed">{product.description}</p>
        <p className="mt-3 text-2xl font-extrabold text-gold">{brl(product.priceCents)}</p>
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-brand-deep">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button type="button" className="grid h-12 w-12 place-items-center rounded-full bg-brand" onClick={() => setQty((value) => Math.max(1, value - 1))} aria-label="Diminuir"><Minus /></button>
          <span className="font-extrabold">{qty}</span>
          <button type="button" className="grid h-12 w-12 place-items-center rounded-full bg-brand" onClick={() => setQty((value) => Math.min(20, value + 1))} aria-label="Aumentar"><Plus /></button>
          <button
            type="button"
            className={btnGold}
            onClick={() => {
              useCart.getState().add({
                title: product.name,
                subtitle: product.description,
                unitCents: product.priceCents,
                request: { kind: "simple", productId: product.id, qty },
              });
              toast.success("Adicionado ao carrinho");
              void navigate({ to: "/carrinho" });
            }}
          >
            Adicionar {brl(product.priceCents * qty)}
          </button>
        </div>
      </div>
    </main>
  );
}

export function PromosPage() {
  const { catalog } = useSession();
  if (!catalog) return null;
  const featured = catalog.products.filter((product) => product.featured || product.badge);
  return (
    <main className="px-4 py-4">
      <h1 className="text-2xl font-extrabold">Promoções</h1>
      <p className="mt-2 text-sm font-semibold text-gold">Cupons de demonstração. O painel pode desativá-los.</p>
      <ul className="mt-4 space-y-3">
        {catalog.coupons.map((coupon) => (
          <li key={coupon.code} className={card}>
            <p className="text-lg font-extrabold text-brand">{coupon.code}</p>
            <p className="text-sm font-semibold">
              {coupon.kind === "percent" ? `${coupon.value}% no subtotal` : `${brl(coupon.value)} de desconto`}
              {coupon.minCents ? ` · mínimo ${brl(coupon.minCents)}` : ""}
            </p>
          </li>
        ))}
        {featured.map((product) => (
          <li key={product.id} className={`${card} flex items-center justify-between gap-3`}>
            <div>
              <p className="font-extrabold">{product.name}</p>
              <p className="text-sm font-medium text-brand-deep">{product.badge || "Destaque"}</p>
            </div>
            <Link to={product.kind === "pizza_flavor" ? "/montar/$id" : "/cardapio"} params={product.kind === "pizza_flavor" ? { id: product.id } : undefined} search={product.kind === "pizza_flavor" ? undefined : { cat: "pizzas", q: product.name }} className="rounded-full bg-gold px-3 py-2 text-sm font-extrabold text-ink">
              Ver
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
