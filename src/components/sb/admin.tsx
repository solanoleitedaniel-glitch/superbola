import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSession } from "./frame";
import {
  createProduct,
  deleteZone,
  getAdminBundle,
  getReport,
  listAdminOrders,
  saveCategory,
  saveFlavorPrice,
  saveNamedOption,
  saveProduct,
  saveSettings,
  saveSize,
  saveZone,
  setOrderStatus,
} from "@/lib/superbola/api";
import {
  DAY_NAMES,
  PAY_LABEL,
  STATUS_LABEL,
  brl,
  errorText,
  formatWhen,
  nextStatuses,
  parseReais,
  reaisInput,
} from "@/lib/superbola/format";

function beep() {
  const Ctx = window.AudioContext;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.value = 0.06;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.18);
}

export function AdminNav() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const links = [
    ["/admin", "Pedidos"],
    ["/admin/cardapio", "Cardápio"],
    ["/admin/ajustes", "Ajustes"],
    ["/admin/relatorios", "Relatórios"],
  ] as const;
  return (
    <header className="no-print border-b border-line bg-brand-deep px-4 py-4 text-cream">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/brand/icone.png" alt="" className="h-12 w-12 rounded-2xl object-cover" />
          <div>
            <p className="text-lg font-extrabold">Painel Super Bola</p>
            <p className="text-xs font-semibold text-gold">Demonstração — o dono vê pedidos, cardápio e relatórios</p>
          </div>
        </div>
        <Link to="/" className="text-sm font-extrabold text-gold">Ver app</Link>
      </div>
      <nav className="no-scroll mt-3 flex gap-2 overflow-x-auto">
        {links.map(([to, label]) => (
          <Link key={to} to={to} className={`shrink-0 rounded-full px-4 py-2 text-sm font-extrabold ${path === to ? "bg-gold text-ink" : "bg-brand text-cream"}`}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function Guard({ children }: { children: ReactNode }) {
  const { me } = useSession();
  if (!me?.role) {
    return (
      <main className="px-4 py-8">
        <AdminNav />
        <p className="mt-6 font-extrabold">Só a equipe acessa o painel.</p>
        <Link to="/conta" className="mt-3 inline-block font-extrabold text-brand">Ir para a conta e assumir a loja</Link>
      </main>
    );
  }
  return <>{children}</>;
}

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listAdminOrders>>>([]);
  const [sound, setSound] = useState(false);
  const [filter, setFilter] = useState("abertos");
  const [note, setNote] = useState("");
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      listAdminOrders()
        .then((rows) => {
          if (!live) return;
          const fresh = new Set(rows.filter((order) => order.status === "received").map((order) => order.id));
          if (seen.current && sound) {
            for (const id of fresh) {
              if (!seen.current.has(id)) beep();
            }
          }
          seen.current = fresh;
          setOrders(rows);
        })
        .catch((error) => {
          if (live) toast.error(errorText(error));
        });
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [sound]);

  const visible = orders.filter((order) => {
    if (filter === "novos") return order.status === "received";
    if (filter === "cozinha") return ["accepted", "preparing", "oven", "ready"].includes(order.status);
    if (filter === "rua") return order.status === "out_for_delivery";
    if (filter === "fim") return ["delivered", "picked_up", "cancelled", "refused"].includes(order.status);
    return !["delivered", "picked_up", "cancelled", "refused"].includes(order.status);
  });
  const count = (status: string) => orders.filter((order) => order.status === status).length;

  return (
    <Guard>
      <AdminNav />
      <main className="px-4 py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Novos", count("received")],
            ["Cozinha", count("preparing") + count("oven") + count("accepted")],
            ["Na rua", count("out_for_delivery")],
            ["Aguardando Pix", count("awaiting_payment")],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-3xl bg-brand-deep p-4 text-cream">
              <p className="text-xs font-bold text-gold">{label}</p>
              <p className="text-3xl font-extrabold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-ink" onClick={() => { setSound(true); beep(); }}>
            {sound ? "Alerta sonoro ligado" : "Ativar alerta sonoro"}
          </button>
          {["abertos", "novos", "cozinha", "rua", "fim"].map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-4 py-2 text-sm font-extrabold ${filter === item ? "bg-brand text-cream" : "bg-cream-2 text-ink"}`}>
              {item}
            </button>
          ))}
        </div>
        <ul className="mt-4 space-y-3">
          {visible.length === 0 ? <li className="rounded-3xl bg-cream-2 p-4 font-semibold">Nenhum pedido nesse filtro.</li> : null}
          {visible.map((order) => (
            <li key={order.id} id={order.id === visible[0]?.id ? "recibo" : undefined} className="rounded-3xl bg-cream-2 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold">#{order.number} · {order.customerName}</p>
                  <p className="text-sm font-semibold text-brand-deep">{order.customerPhone} · {formatWhen(order.createdAt)}</p>
                </div>
                <p className="rounded-full bg-gold px-3 py-1 text-sm font-extrabold text-ink">{STATUS_LABEL[order.status] ?? order.status}</p>
              </div>
              <ul className="mt-3 space-y-1 text-sm font-semibold">
                {order.items.map((item, index) => (
                  <li key={`${item.name}-${index}`}>{item.qty}× {item.name} — {item.detail}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-semibold">
                {order.mode === "delivery" ? `Entrega · ${order.zoneName}` : "Retirada"} · {PAY_LABEL[order.paymentMethod]} · {brl(order.totalCents)}
              </p>
              {order.address ? (
                <p className="text-sm font-medium">
                  {order.address.street}, {order.address.number} — {order.address.neighborhood}. {order.address.reference}
                </p>
              ) : null}
              {order.changeForCents ? <p className="text-sm font-bold">Troco para {brl(order.changeForCents)}</p> : null}
              {order.notes ? <p className="text-sm font-medium">Obs: {order.notes}</p> : null}
              {order.status === "awaiting_payment" ? (
                <p className="mt-2 text-sm font-extrabold text-brand">Aguardando o Mercado Pago. Não marque como pago manualmente.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextStatuses(order.status, order.mode).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`rounded-full px-3 py-2 text-sm font-extrabold ${status === "cancelled" || status === "refused" ? "bg-brand text-cream" : "bg-ok text-cream"}`}
                      onClick={() => {
                        if ((status === "cancelled" || status === "refused") && note.trim().length < 3) {
                          toast.error("Escreva o motivo no campo abaixo antes de recusar ou cancelar.");
                          return;
                        }
                        void setOrderStatus({ data: { id: order.id, status, note } })
                          .then(() => listAdminOrders().then(setOrders))
                          .catch((error) => toast.error(errorText(error)));
                      }}
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  ))}
                  <button type="button" className="rounded-full bg-cream-2 px-3 py-2 text-sm font-extrabold" onClick={() => window.print()}>
                    Imprimir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <label className="mt-4 block text-sm font-bold">
          Motivo de recusa ou cancelamento
          <input className="mt-1 h-12 w-full rounded-2xl bg-cream-2 px-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Obrigatório para recusar ou cancelar" />
        </label>
      </main>
    </Guard>
  );
}

type Bundle = Awaited<ReturnType<typeof getAdminBundle>>;

function useBundle() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const reload = () => getAdminBundle().then(setBundle).catch((error) => toast.error(errorText(error)));
  useEffect(() => {
    void reload();
  }, []);
  return { bundle, reload };
}

export function AdminMenuPage() {
  const { bundle, reload } = useBundle();
  const [draft, setDraft] = useState({ name: "", categoryId: "cat-pizzas", kind: "simple", price: "39,90", description: "" });
  if (!bundle) {
    return (
      <Guard>
        <AdminNav />
        <p className="p-4 font-bold">Carregando cardápio…</p>
      </Guard>
    );
  }
  return (
    <Guard>
      <AdminNav />
      <main className="space-y-4 px-4 py-4">
        <form
          className="grid gap-2 rounded-3xl bg-cream-2 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const price = parseReais(draft.price);
            if (price == null) return toast.error("Preço inválido.");
            void createProduct({
              data: { ...draft, priceCents: price },
            })
              .then(() => {
                toast.success("Produto criado");
                setDraft({ ...draft, name: "" });
                return reload();
              })
              .catch((error) => toast.error(errorText(error)));
          }}
        >
          <h2 className="text-lg font-extrabold">Novo produto</h2>
          <input className="h-11 rounded-xl bg-cream px-3 font-semibold" placeholder="Nome" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="h-11 rounded-xl bg-cream px-3 font-semibold" value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>
              {bundle.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <select className="h-11 rounded-xl bg-cream px-3 font-semibold" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })}>
              <option value="simple">Produto</option>
              <option value="pizza_flavor">Sabor de pizza</option>
              <option value="combo">Combo</option>
            </select>
          </div>
          <input className="h-11 rounded-xl bg-cream px-3 font-semibold" placeholder="Preço" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
          <input className="h-11 rounded-xl bg-cream px-3 font-semibold" placeholder="Descrição" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          <button className="h-12 rounded-2xl bg-gold font-extrabold text-ink" type="submit">Cadastrar</button>
        </form>

        <section className="rounded-3xl bg-cream-2 p-4">
          <h2 className="font-extrabold">Tamanhos</h2>
          <ul className="mt-2 space-y-2">
            {bundle.sizes.map((size) => (
              <SizeRow key={size.id} size={size} onSaved={reload} />
            ))}
          </ul>
          <p className="mt-2 text-sm font-semibold text-brand-deep">Regra de preço da pizza dividida: {bundle.store.priceRule === "average" ? "média" : "sabor mais caro"} (mude em Ajustes).</p>
        </section>

        {bundle.products.map((product) => (
          <ProductEditor key={product.id} product={product} bundle={bundle} onSaved={reload} />
        ))}

        <OptionEditor title="Bordas" table="crusts" rows={bundle.crusts} onSaved={reload} />
        <OptionEditor title="Adicionais" table="extras" rows={bundle.extras} onSaved={reload} />

        <section className="rounded-3xl bg-cream-2 p-4">
          <h2 className="font-extrabold">Categorias</h2>
          <ul className="mt-2 space-y-2">
            {bundle.categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-2">
                <span className="font-bold">{category.name}</span>
                <button type="button" className="text-sm font-extrabold text-brand" onClick={() => void saveCategory({ data: { id: category.id, name: category.name, active: !category.active } }).then(reload)}>
                  {category.active ? "Ocultar" : "Mostrar"}
                </button>
              </li>
            ))}
          </ul>
          <CategoryCreate onSaved={reload} />
        </section>
      </main>
    </Guard>
  );
}

function SizeRow({ size, onSaved }: { size: Bundle["sizes"][number]; onSaved: () => void }) {
  const [name, setName] = useState(size.name);
  const [max, setMax] = useState(String(size.maxFlavors));
  return (
    <li className="flex flex-wrap items-center gap-2">
      <input className="h-10 rounded-xl bg-cream px-2 font-semibold" value={name} onChange={(event) => setName(event.target.value)} />
      <input className="h-10 w-16 rounded-xl bg-cream px-2 font-semibold" value={max} onChange={(event) => setMax(event.target.value)} aria-label="Máximo de sabores" />
      <button type="button" className="text-sm font-extrabold text-brand" onClick={() => void saveSize({ data: { id: size.id, name, maxFlavors: Number(max), active: size.active } }).then(onSaved).catch((error) => toast.error(errorText(error)))}>
        Salvar
      </button>
    </li>
  );
}

function ProductEditor({ product, bundle, onSaved }: { product: Bundle["products"][number]; bundle: Bundle; onSaved: () => void }) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [price, setPrice] = useState(reaisInput(product.priceCents));
  const [active, setActive] = useState(product.active);
  const [featured, setFeatured] = useState(product.featured);
  const prices = bundle.flavorPrices.filter((item) => item.productId === product.id);
  return (
    <article className="rounded-3xl bg-cream-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-extrabold">{product.name}</h2>
        <span className="text-xs font-bold text-brand-deep">{product.kind === "pizza_flavor" ? "sabor" : product.kind}</span>
      </div>
      <div className="mt-2 grid gap-2">
        <input className="h-11 rounded-xl bg-cream px-3 font-semibold" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="h-11 rounded-xl bg-cream px-3 font-semibold" value={description} onChange={(event) => setDescription(event.target.value)} />
        {product.kind === "pizza_flavor" ? (
          <div className="grid grid-cols-2 gap-2">
            {bundle.sizes.map((size) => {
              const current = prices.find((item) => item.sizeId === size.id)?.priceCents ?? 0;
              return (
                <label key={size.id} className="text-xs font-bold">
                  {size.name}
                  <input
                    className="mt-1 h-10 w-full rounded-xl bg-cream px-2 font-semibold"
                    defaultValue={reaisInput(current)}
                    onBlur={(event) => {
                      const cents = parseReais(event.target.value);
                      if (cents == null) return toast.error("Preço inválido");
                      void saveFlavorPrice({ data: { productId: product.id, sizeId: size.id, priceCents: cents } }).then(() => toast.success("Preço salvo"));
                    }}
                  />
                </label>
              );
            })}
          </div>
        ) : (
          <input className="h-11 rounded-xl bg-cream px-3 font-semibold" value={price} onChange={(event) => setPrice(event.target.value)} />
        )}
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Disponível</label>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /> Destaque</label>
        <button
          type="button"
          className="h-11 rounded-2xl bg-brand font-extrabold text-cream"
          onClick={() => {
            const cents = parseReais(price);
            if (product.kind !== "pizza_flavor" && cents == null) return toast.error("Preço inválido");
            void saveProduct({
              data: { id: product.id, name, description, priceCents: cents ?? 0, active, featured, badge: product.badge },
            })
              .then(() => {
                toast.success("Produto atualizado");
                onSaved();
              })
              .catch((error) => toast.error(errorText(error)));
          }}
        >
          Salvar produto
        </button>
      </div>
    </article>
  );
}

function OptionEditor({
  title,
  table,
  rows,
  onSaved,
}: {
  title: string;
  table: "crusts" | "extras";
  rows: Bundle["crusts"];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0,00");
  return (
    <section className="rounded-3xl bg-cream-2 p-4">
      <h2 className="font-extrabold">{title}</h2>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between text-sm font-bold">
            <span>{row.name} · {brl(row.priceCents)}</span>
            <button type="button" className="text-brand" onClick={() => void saveNamedOption({ data: { table, id: row.id, name: row.name, priceCents: row.priceCents, active: !row.active } }).then(onSaved)}>
              {row.active ? "Desativar" : "Ativar"}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className="h-11 flex-1 rounded-xl bg-cream px-3 font-semibold" placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="h-11 w-24 rounded-xl bg-cream px-3 font-semibold" value={price} onChange={(event) => setPrice(event.target.value)} />
        <button
          type="button"
          className="rounded-xl bg-gold px-3 font-extrabold text-ink"
          onClick={() => {
            const cents = parseReais(price);
            if (cents == null || name.trim().length < 2) return toast.error("Preencha nome e preço.");
            void saveNamedOption({ data: { table, name, priceCents: cents, active: true } }).then(() => {
              setName("");
              onSaved();
            });
          }}
        >
          Add
        </button>
      </div>
    </section>
  );
}

function CategoryCreate({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void saveCategory({ data: { name, active: true } })
          .then(() => {
            setName("");
            onSaved();
          })
          .catch((error) => toast.error(errorText(error)));
      }}
    >
      <input className="h-11 flex-1 rounded-xl bg-cream px-3 font-semibold" placeholder="Nova categoria" value={name} onChange={(event) => setName(event.target.value)} />
      <button className="rounded-xl bg-gold px-3 font-extrabold text-ink" type="submit">Criar</button>
    </form>
  );
}

export function AdminSettingsPage() {
  const { bundle, reload } = useBundle();
  const [zone, setZone] = useState({ neighborhood: "", fee: "7,00", eta: "45" });
  if (!bundle) {
    return (
      <Guard>
        <AdminNav />
        <p className="p-4 font-bold">Carregando ajustes…</p>
      </Guard>
    );
  }
  const store = bundle.store;
  return (
    <Guard>
      <AdminNav />
      <main className="space-y-4 px-4 py-4">
        <form
          className="grid gap-2 rounded-3xl bg-cream-2 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const min = parseReais(String(data.get("min") ?? "0"));
            if (min == null) return toast.error("Pedido mínimo inválido.");
            const hours = store.hours.map((hour, index) => ({
              day: index,
              open: String(data.get(`open-${index}`) ?? hour.open),
              close: String(data.get(`close-${index}`) ?? hour.close),
              closed: data.get(`closed-${index}`) === "on",
            }));
            void saveSettings({
              data: {
                phone: String(data.get("phone") ?? ""),
                whatsapp: String(data.get("whatsapp") ?? ""),
                addressLine: String(data.get("address") ?? ""),
                city: String(data.get("city") ?? ""),
                state: String(data.get("state") ?? ""),
                prepMinutes: Number(data.get("prep")),
                pickupMinutes: Number(data.get("pickup")),
                minOrderCents: min,
                forceStatus: String(data.get("force")),
                priceRule: String(data.get("rule")),
                joinCode: String(data.get("code")),
                demoNotice: data.get("demo") === "on",
                payments: {
                  cash: data.get("cash") === "on",
                  card_delivery: data.get("card_delivery") === "on",
                  pix_online: data.get("pix") === "on",
                  card_online: false,
                },
                hours,
              },
            })
              .then(() => {
                toast.success("Ajustes salvos");
                reload();
              })
              .catch((error) => toast.error(errorText(error)));
          }}
        >
          <h2 className="text-lg font-extrabold">Loja</h2>
          <input name="phone" defaultValue={store.phone} className="h-11 rounded-xl bg-cream px-3" placeholder="Telefone" />
          <input name="whatsapp" defaultValue={store.whatsapp} className="h-11 rounded-xl bg-cream px-3" placeholder="WhatsApp (só números)" />
          <input name="address" defaultValue={store.addressLine} className="h-11 rounded-xl bg-cream px-3" placeholder="Endereço da loja" />
          <div className="grid grid-cols-3 gap-2">
            <input name="city" defaultValue={store.city} className="col-span-2 h-11 rounded-xl bg-cream px-3" placeholder="Cidade" />
            <input name="state" defaultValue={store.state} className="h-11 rounded-xl bg-cream px-3" placeholder="UF" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold">Preparo (min)<input name="prep" type="number" defaultValue={store.prepMinutes} className="mt-1 h-11 w-full rounded-xl bg-cream px-3" /></label>
            <label className="text-xs font-bold">Retirada (min)<input name="pickup" type="number" defaultValue={store.pickupMinutes} className="mt-1 h-11 w-full rounded-xl bg-cream px-3" /></label>
          </div>
          <label className="text-xs font-bold">Pedido mínimo<input name="min" defaultValue={reaisInput(store.minOrderCents)} className="mt-1 h-11 w-full rounded-xl bg-cream px-3" /></label>
          <label className="text-xs font-bold">
            Situação
            <select name="force" defaultValue={store.forceStatus} className="mt-1 h-11 w-full rounded-xl bg-cream px-3 font-semibold">
              <option value="auto">Pelo horário</option>
              <option value="open">Forçar aberto</option>
              <option value="closed">Forçar fechado</option>
            </select>
          </label>
          <label className="text-xs font-bold">
            Pizza de vários sabores
            <select name="rule" defaultValue={store.priceRule} className="mt-1 h-11 w-full rounded-xl bg-cream px-3 font-semibold">
              <option value="max">Cobrar o sabor mais caro</option>
              <option value="average">Cobrar a média</option>
            </select>
          </label>
          <label className="text-xs font-bold">Código da equipe<input name="code" defaultValue={store.joinCode ?? ""} className="mt-1 h-11 w-full rounded-xl bg-cream px-3 font-semibold" /></label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="demo" defaultChecked={store.demoNotice} /> Mostrar aviso de cardápio demonstrativo</label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="cash" defaultChecked={store.payments.cash} /> Dinheiro na entrega</label>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="card_delivery" defaultChecked={store.payments.card_delivery} /> Cartão na entrega</label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="pix" defaultChecked={store.payments.pix_online} disabled={!bundle.pixConfigured} />
            Pix online
          </label>
          <p className="text-sm font-medium text-brand-deep">
            {bundle.pixConfigured
              ? "Credencial do Mercado Pago detectada. O Pix só confirma por webhook assinado."
              : "Pix e cartão online ficam desligados até existirem MERCADO_PAGO_ACCESS_TOKEN e MERCADO_PAGO_WEBHOOK_SECRET no servidor. O aviso de pagamento em /api/pagamentos/webhook recusa qualquer aviso sem assinatura. Nada é marcado como pago no clique do cliente."}
          </p>
          <h3 className="pt-2 font-extrabold">Horários (horário de Brasília)</h3>
          {store.hours.map((hour) => (
            <div key={hour.day} className="grid grid-cols-4 items-center gap-2 text-sm font-bold">
              <span>{DAY_NAMES[hour.day]}</span>
              <input name={`open-${hour.day}`} defaultValue={hour.open} className="h-10 rounded-xl bg-cream px-2" />
              <input name={`close-${hour.day}`} defaultValue={hour.close} className="h-10 rounded-xl bg-cream px-2" />
              <label className="text-xs"><input type="checkbox" name={`closed-${hour.day}`} defaultChecked={hour.closed} /> fechado</label>
            </div>
          ))}
          <button className="mt-2 h-12 rounded-2xl bg-gold font-extrabold text-ink" type="submit">Salvar ajustes</button>
        </form>

        <section className="rounded-3xl bg-cream-2 p-4">
          <h2 className="font-extrabold">Área de entrega</h2>
          <p className="text-sm font-medium text-brand-deep">Os bairros iniciais são demonstração. Apague e cadastre os reais.</p>
          <ul className="mt-3 space-y-2">
            {bundle.zones.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm font-bold">
                <span>{item.neighborhood} · {brl(item.feeCents)} · {item.etaMinutes} min</span>
                <button type="button" className="text-brand" onClick={() => void deleteZone({ data: { id: item.id } }).then(reload)}>Excluir</button>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2">
            <input className="h-11 rounded-xl bg-cream px-3 font-semibold" placeholder="Bairro" value={zone.neighborhood} onChange={(event) => setZone({ ...zone, neighborhood: event.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="h-11 rounded-xl bg-cream px-3 font-semibold" placeholder="Taxa" value={zone.fee} onChange={(event) => setZone({ ...zone, fee: event.target.value })} />
              <input className="h-11 rounded-xl bg-cream px-3 font-semibold" placeholder="Minutos" value={zone.eta} onChange={(event) => setZone({ ...zone, eta: event.target.value })} />
            </div>
            <button
              type="button"
              className="h-11 rounded-2xl bg-brand font-extrabold text-cream"
              onClick={() => {
                const fee = parseReais(zone.fee);
                if (fee == null) return toast.error("Taxa inválida");
                void saveZone({ data: { neighborhood: zone.neighborhood, feeCents: fee, etaMinutes: Number(zone.eta), active: true, city: "" } })
                  .then(() => {
                    setZone({ neighborhood: "", fee: "7,00", eta: "45" });
                    reload();
                  })
                  .catch((error) => toast.error(errorText(error)));
              }}
            >
              Adicionar bairro
            </button>
          </div>
        </section>
      </main>
    </Guard>
  );
}

export function AdminReportPage() {
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [report, setReport] = useState<Awaited<ReturnType<typeof getReport>> | null>(null);
  useEffect(() => {
    void getReport({ data: { days } }).then(setReport).catch((error) => toast.error(errorText(error)));
  }, [days]);
  return (
    <Guard>
      <AdminNav />
      <main className="px-4 py-4">
        <div className="flex gap-2">
          {[7, 30, 90].map((item) => (
            <button key={item} type="button" onClick={() => setDays(item as 7 | 30 | 90)} className={`rounded-full px-4 py-2 text-sm font-extrabold ${days === item ? "bg-gold text-ink" : "bg-cream-2"}`}>
              {item} dias
            </button>
          ))}
        </div>
        {!report ? <p className="mt-4 font-bold">Calculando…</p> : null}
        {report ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="rounded-3xl bg-brand-deep p-4 text-cream"><p className="text-sm text-gold">Pedidos</p><p className="text-3xl font-extrabold">{report.count}</p></article>
            <article className="rounded-3xl bg-brand-deep p-4 text-cream"><p className="text-sm text-gold">Faturado (pago)</p><p className="text-3xl font-extrabold">{brl(report.revenueCents)}</p></article>
            <article className="rounded-3xl bg-cream-2 p-4"><p className="text-sm font-bold text-brand-deep">Ticket médio</p><p className="text-2xl font-extrabold">{brl(report.avgTicketCents)}</p></article>
            <article className="rounded-3xl bg-cream-2 p-4"><p className="text-sm font-bold text-brand-deep">Cancelados ou recusados</p><p className="text-2xl font-extrabold">{report.cancelled}</p></article>
            <article className="rounded-3xl bg-cream-2 p-4 sm:col-span-2">
              <h2 className="font-extrabold">Por pagamento</h2>
              <ul className="mt-2 space-y-1 text-sm font-semibold">
                {report.byPayment.map((item) => (
                  <li key={item.method} className="flex justify-between"><span>{PAY_LABEL[item.method] ?? item.method}</span><span>{item.count} · {brl(item.totalCents)}</span></li>
                ))}
              </ul>
            </article>
            <article className="rounded-3xl bg-cream-2 p-4 sm:col-span-2">
              <h2 className="font-extrabold">Mais vendidos</h2>
              <ul className="mt-2 space-y-1 text-sm font-semibold">
                {report.top.map((item) => (
                  <li key={item.name} className="flex justify-between"><span>{item.name}</span><span>{item.qty} · {brl(item.totalCents)}</span></li>
                ))}
                {report.top.length === 0 ? <li>Sem vendas no período.</li> : null}
              </ul>
            </article>
          </div>
        ) : null}
      </main>
    </Guard>
  );
}
