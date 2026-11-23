import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "./frame";
import { btnBrand, btnGold, card } from "./ui";
import {
  cancelMyOrder,
  getOrder,
  listAddresses,
  placeOrder,
  previewOrder,
  saveAddress,
} from "@/lib/superbola/api";
import { cartSubtotal, useCart } from "@/lib/superbola/cart";
import {
  PAY_LABEL,
  PAY_STATUS_LABEL,
  STATUS_LABEL,
  brl,
  deliverySteps,
  errorText,
  formatWhen,
  parseReais,
} from "@/lib/superbola/format";

type Address = Awaited<ReturnType<typeof listAddresses>>[number];

export function CartPage() {
  const lines = useCart((state) => state.lines);
  const mode = useCart((state) => state.mode);
  const subtotal = cartSubtotal(lines);
  return (
    <main className="px-4 py-4">
      <h1 className="text-2xl font-extrabold">Seu pedido</h1>
      <p className="mt-1 text-sm font-semibold text-gold">{mode === "delivery" ? "Entrega" : "Retirada na loja"}</p>
      {lines.length === 0 ? (
        <div className={`${card} mt-4 text-center`}>
          <p className="font-extrabold">O carrinho está vazio.</p>
          <Link to="/cardapio" search={{ cat: "pizzas", q: "" }} className="mt-3 inline-flex rounded-full bg-gold px-4 py-2 font-extrabold text-ink">
            Ver cardápio
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {lines.map((line) => (
            <li key={line.key} className={card}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold">{line.title}</p>
                  <p className="mt-1 text-sm font-medium text-brand-deep">{line.subtitle}</p>
                </div>
                <button type="button" aria-label="Remover" className="text-brand" onClick={() => useCart.getState().remove(line.key)}>
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-gold text-ink" onClick={() => useCart.getState().setQty(line.key, line.request.qty - 1)} aria-label="Diminuir"><Minus className="h-4 w-4" /></button>
                  <span className="font-extrabold">{line.request.qty}</span>
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-gold text-ink" onClick={() => useCart.getState().setQty(line.key, Math.min(20, line.request.qty + 1))} aria-label="Aumentar"><Plus className="h-4 w-4" /></button>
                </div>
                <span className="font-extrabold">{brl(line.unitCents * line.request.qty)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {lines.length > 0 ? (
        <div className="mt-4">
          <p className="text-right text-lg font-extrabold">Subtotal {brl(subtotal)}</p>
          <p className="mt-1 text-right text-xs font-semibold text-gold">A taxa, o cupom e o total final são calculados no servidor.</p>
          <Link to="/checkout" className={`${btnGold} mt-4`}>Continuar</Link>
        </div>
      ) : null}
    </main>
  );
}

const emptyAddress = {
  label: "Casa",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: "",
};

export function CheckoutPage() {
  const { me, catalog } = useSession();
  const lines = useCart((state) => state.lines);
  const mode = useCart((state) => state.mode);
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState("");
  const [form, setForm] = useState(emptyAddress);
  const [showForm, setShowForm] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [method, setMethod] = useState<"cash" | "card_delivery" | "pix_online" | "card_online">("cash");
  const [change, setChange] = useState("");
  const [name, setName] = useState(me?.name ?? "");
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof previewOrder>> | null>(null);
  const [sending, setSending] = useState(false);
  const token = useRef(crypto.randomUUID());

  useEffect(() => {
    void listAddresses().then((rows) => {
      setAddresses(rows);
      if (rows[0]) setAddressId(rows[0].id);
      else setShowForm(true);
    }).catch((error) => toast.error(errorText(error)));
  }, []);

  const payload = useMemo(
    () => ({
      mode,
      addressId: mode === "delivery" ? addressId : null,
      couponCode: coupon,
      items: lines.map((line) => line.request),
    }),
    [mode, addressId, coupon, lines],
  );

  useEffect(() => {
    if (!lines.length) return;
    if (mode === "delivery" && !addressId) {
      setQuote(null);
      return;
    }
    let live = true;
    void previewOrder({ data: payload })
      .then((result) => {
        if (live) setQuote(result);
      })
      .catch((error) => {
        if (live) setQuote({ ok: false, error: errorText(error) });
      });
    return () => {
      live = false;
    };
  }, [payload, lines.length, mode, addressId]);

  async function lookupCep() {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      toast.error("CEP precisa ter 8 números.");
      return;
    }
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const body = (await response.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (body.erro) throw new Error("CEP não encontrado. Preencha manualmente.");
      setForm((current) => ({
        ...current,
        street: body.logradouro || current.street,
        neighborhood: body.bairro || current.neighborhood,
        city: body.localidade || current.city,
        state: body.uf || current.state,
      }));
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function addAddress() {
    try {
      const saved = await saveAddress({ data: form });
      const rows = await listAddresses();
      setAddresses(rows);
      setAddressId(saved.id);
      setShowForm(false);
      toast.success("Endereço salvo");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function submit() {
    if (sending || !lines.length) return;
    setSending(true);
    try {
      const changeCents = change.trim() ? parseReais(change) : null;
      if (change.trim() && changeCents == null) {
        toast.error("Valor de troco inválido.");
        setSending(false);
        return;
      }
      const result = await placeOrder({
        data: {
          ...payload,
          clientToken: token.current,
          paymentMethod: method,
          changeForCents: Number.isFinite(changeCents) ? changeCents : null,
          customerName: name,
          customerPhone: phone,
          notes,
        },
      });
      useCart.getState().clear();
      token.current = crypto.randomUUID();
      void navigate({ to: "/pedido/$id", params: { id: result.id } });
    } catch (error) {
      toast.error(errorText(error));
      setSending(false);
    }
  }

  if (!catalog) return null;
  const payments = catalog.store.payments;
  return (
    <main className="px-4 py-4 pb-28">
      <h1 className="text-2xl font-extrabold">Finalizar</h1>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["delivery", "pickup"] as const).map((item) => (
          <button key={item} type="button" onClick={() => useCart.getState().setMode(item)} className={`h-12 rounded-2xl font-extrabold ${mode === item ? "bg-gold text-ink" : "bg-brand text-cream"}`}>
            {item === "delivery" ? "Entrega" : "Retirada"}
          </button>
        ))}
      </div>

      {mode === "pickup" ? (
        <p className={`${card} mt-4 text-sm font-semibold`}>
          Retirada no balcão.
          {catalog.store.addressLine
            ? ` ${catalog.store.addressLine}, ${catalog.store.city}`
            : " O endereço da loja ainda não foi cadastrado pelo proprietário."}
        </p>
      ) : (
        <section className="mt-4 space-y-2">
          {addresses.map((address) => (
            <button key={address.id} type="button" onClick={() => setAddressId(address.id)} className={`${card} w-full text-left ${address.id === addressId ? "ring-4 ring-gold" : ""}`}>
              <span className="font-extrabold">{address.label}</span>
              <span className="mt-1 block text-sm font-medium">
                {address.street}, {address.number} — {address.neighborhood}, {address.city}/{address.state}
              </span>
            </button>
          ))}
          <button type="button" className="text-sm font-extrabold text-gold" onClick={() => setShowForm((value) => !value)}>
            {showForm ? "Fechar endereço" : "Novo endereço"}
          </button>
          {showForm ? (
            <div className={`${card} grid gap-2`}>
              <input className="h-11 rounded-xl bg-cream-2 px-3 font-semibold" placeholder="Apelido" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
              <div className="flex gap-2">
                <input className="h-11 flex-1 rounded-xl bg-cream-2 px-3 font-semibold" placeholder="CEP" inputMode="numeric" value={form.cep} onChange={(event) => setForm({ ...form, cep: event.target.value })} />
                <button type="button" className="rounded-xl bg-gold px-3 text-sm font-extrabold text-ink" onClick={() => void lookupCep()}>Buscar</button>
              </div>
              <input className="h-11 rounded-xl bg-cream-2 px-3 font-semibold" placeholder="Rua" value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="h-11 rounded-xl bg-cream-2 px-3 font-semibold" placeholder="Número" value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} />
                <input className="h-11 rounded-xl bg-cream-2 px-3 font-semibold" placeholder="Complemento" value={form.complement} onChange={(event) => setForm({ ...form, complement: event.target.value })} />
              </div>
              <input className="h-11 rounded-xl bg-cream-2 px-3 font-semibold" placeholder="Bairro" value={form.neighborhood} onChange={(event) => setForm({ ...form, neighborhood: event.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <input className="col-span-2 h-11 rounded-xl bg-cream-2 px-3 font-semibold" placeholder="Cidade" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
                <input className="h-11 rounded-xl bg-cream-2 px-3 font-semibold" placeholder="UF" maxLength={2} value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
              </div>
              <input className="h-11 rounded-xl bg-cream-2 px-3 font-semibold" placeholder="Referência" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} />
              <button type="button" className={btnBrand} onClick={() => void addAddress()}>Salvar endereço</button>
            </div>
          ) : null}
          <p className="text-xs font-semibold text-gold">Bairros de demonstração: {catalog.zones.map((zone) => zone.neighborhood).join(" · ") || "nenhum"}.</p>
        </section>
      )}

      <section className="mt-4 grid gap-2">
        <input className="h-12 rounded-2xl bg-cream px-3 font-semibold text-ink" placeholder="Seu nome" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="h-12 rounded-2xl bg-cream px-3 font-semibold text-ink" placeholder="Telefone com DDD" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <input className="h-12 rounded-2xl bg-cream px-3 font-semibold text-ink" placeholder="Cupom" value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} />
        <textarea className="h-20 rounded-2xl bg-cream p-3 font-semibold text-ink" placeholder="Observação do pedido" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </section>

      <fieldset className="mt-4 space-y-2">
        <legend className="font-extrabold">Pagamento</legend>
        {([
          ["cash", "Dinheiro na entrega"],
          ["card_delivery", "Cartão na entrega"],
          ["pix_online", catalog.pixReady ? "Pix" : "Pix (aguardando Mercado Pago)"],
          ["card_online", "Cartão online (indisponível)"],
        ] as const).map(([id, label]) => {
          const enabled = id === "pix_online" ? catalog.pixReady : id === "card_online" ? false : payments[id];
          return (
            <label key={id} className={`${card} flex items-center gap-3 ${enabled ? "" : "opacity-60"}`}>
              <input type="radio" name="pay" disabled={!enabled} checked={method === id} onChange={() => setMethod(id)} />
              <span className="font-bold">{label}</span>
            </label>
          );
        })}
        {method === "cash" ? (
          <input className="h-12 rounded-2xl bg-cream px-3 font-semibold text-ink" placeholder="Troco para quanto? (opcional)" value={change} onChange={(event) => setChange(event.target.value)} />
        ) : null}
        <p className="text-xs font-semibold text-gold">Pagamento online só é confirmado pelo Mercado Pago. Não há aprovação simulada.</p>
      </fieldset>

      <section className={`${card} mt-4`}>
        {!quote ? <p className="font-semibold">Calculando…</p> : null}
        {quote && !quote.ok ? <p className="font-bold text-brand">{quote.error}</p> : null}
        {quote && quote.ok ? (
          <dl className="space-y-1 text-sm font-semibold">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{brl(quote.subtotalCents)}</dd></div>
            <div className="flex justify-between"><dt>Entrega {quote.zoneName ? `· ${quote.zoneName}` : ""}</dt><dd>{brl(quote.deliveryCents)}</dd></div>
            <div className="flex justify-between"><dt>Desconto</dt><dd>- {brl(quote.discountCents)}</dd></div>
            <div className="flex justify-between text-lg font-extrabold"><dt>Total</dt><dd>{brl(quote.totalCents)}</dd></div>
            <p>Previsão de {quote.etaMinutes} min {quote.open.isOpen ? "" : `· ${quote.open.label}`}</p>
          </dl>
        ) : null}
      </section>

      <button type="button" disabled={sending || !quote?.ok} className={`${btnGold} mt-4`} onClick={() => void submit()}>
        {sending ? "Enviando…" : "Confirmar pedido"}
      </button>
    </main>
  );
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof getOrder>>["order"][]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () =>
      import("@/lib/superbola/api").then(({ listMyOrders }) =>
        listMyOrders()
          .then((rows) => {
            if (live) setOrders(rows);
          })
          .catch((reason) => {
            if (live) setError(errorText(reason));
          }),
      );
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <main className="px-4 py-4">
      <h1 className="text-2xl font-extrabold">Meus pedidos</h1>
      {error ? <p className="mt-3 font-semibold text-gold">{error}</p> : null}
      {orders.length === 0 ? <p className={`${card} mt-4 text-center font-semibold`}>Você ainda não fez pedidos.</p> : null}
      <ul className="mt-4 space-y-3">
        {orders.map((order) => (
          <li key={order.id}>
            <Link to="/pedido/$id" params={{ id: order.id }} className={`${card} block`}>
              <span className="flex items-center justify-between">
                <span className="font-extrabold">#{order.number}</span>
                <span className="text-sm font-extrabold text-brand">{STATUS_LABEL[order.status] ?? order.status}</span>
              </span>
              <span className="mt-1 block text-sm font-medium">{formatWhen(order.createdAt)} · {brl(order.totalCents)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function OrderPage() {
  const { id } = useParams({ from: "/pedido/$id" });
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof getOrder>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () =>
      getOrder({ data: { id } })
        .then((result) => {
          if (live) setData(result);
        })
        .catch((reason) => {
          if (live) setError(errorText(reason));
        });
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id]);

  if (error) return <main className="px-4 py-8 font-bold">{error}</main>;
  if (!data) return <main className="px-4 py-8 font-bold">Carregando pedido…</main>;
  const { order } = data;
  const steps = deliverySteps(order.mode);
  const cancelled = order.status === "cancelled" || order.status === "refused";
  const currentIndex = steps.indexOf(order.status);

  function repeat() {
    for (const item of order.items) {
      const meta = item.meta ?? {};
      if (item.kind === "pizza") {
        useCart.getState().add({
          title: item.name,
          subtitle: item.detail,
          unitCents: item.unitCents,
          request: {
            kind: "pizza",
            sizeId: String(meta.sizeId ?? ""),
            flavorIds: Array.isArray(meta.flavorIds) ? meta.flavorIds.filter((value) => typeof value === "string") : [],
            crustId: typeof meta.crustId === "string" ? meta.crustId : null,
            extraIds: Array.isArray(meta.extraIds) ? meta.extraIds.filter((value) => typeof value === "string") : [],
            notes: typeof meta.notes === "string" ? meta.notes : "",
            qty: item.qty,
          },
        });
      } else if (typeof meta.productId === "string") {
        useCart.getState().add({
          title: item.name,
          subtitle: item.detail,
          unitCents: item.unitCents,
          request: { kind: "simple", productId: meta.productId, qty: item.qty },
        });
      }
    }
    toast.success("Itens colocados no carrinho");
    void navigate({ to: "/carrinho" });
  }

  return (
    <main className="px-4 py-4">
      <img src="/brand/mascote.png" alt="" className="mx-auto h-24 w-24 rounded-3xl object-cover" />
      <h1 className="mt-3 text-center text-2xl font-extrabold">Pedido #{order.number}</h1>
      <p className="text-center text-sm font-semibold text-gold">
        {order.mode === "delivery" ? "Entrega" : "Retirada"} · {PAY_LABEL[order.paymentMethod] ?? order.paymentMethod} · {PAY_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
      </p>
      {order.etaAt && !cancelled ? <p className="mt-1 text-center text-sm font-bold">Previsão {formatWhen(order.etaAt)}</p> : null}

      {order.status === "awaiting_payment" && order.pixQr ? (
        <section className={`${card} mt-4 text-center`}>
          <p className="font-extrabold">Pague o Pix para a cozinha receber o pedido</p>
          <p className="mt-1 text-sm font-medium">A confirmação vem só do Mercado Pago. Não existe botão de “já paguei”.</p>
          {order.pixQrBase64 ? <img alt="QR Code Pix" className="mx-auto mt-3 h-48 w-48 rounded-2xl bg-cream" src={`data:image/png;base64,${order.pixQrBase64}`} /> : null}
          <textarea readOnly className="mt-3 h-24 w-full rounded-2xl bg-cream-2 p-2 text-xs font-medium" value={order.pixQr} />
          <button type="button" className={`${btnBrand} mt-2`} onClick={() => void navigator.clipboard.writeText(order.pixQr).then(() => toast.success("Código copiado"))}>
            Copiar código
          </button>
        </section>
      ) : null}

      <ol className="mt-4 space-y-2">
        {cancelled ? (
          <li className={`${card} font-extrabold text-brand`}>{STATUS_LABEL[order.status]}</li>
        ) : (
          steps.map((step, index) => {
            const done = order.status === "awaiting_payment" ? false : index <= currentIndex;
            return (
              <li key={step} className={`${card} flex items-center gap-3`}>
                <span className={`grid h-8 w-8 place-items-center rounded-full ${done ? "bg-ok text-cream" : "bg-cream-2 text-brand-deep"}`}>
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span className="font-extrabold">{STATUS_LABEL[step]}</span>
              </li>
            );
          })
        )}
      </ol>

      <section id="recibo" className={`${card} mt-4`}>
        <ul className="space-y-2">
          {order.items.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              <p className="font-extrabold">{item.qty}× {item.name}</p>
              <p className="text-sm font-medium text-brand-deep">{item.detail}</p>
              <p className="text-sm font-extrabold">{brl(item.totalCents)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right text-lg font-extrabold">Total {brl(order.totalCents)}</p>
        {order.address ? (
          <p className="mt-2 text-sm font-medium">
            {order.address.street}, {order.address.number} — {order.address.neighborhood}
          </p>
        ) : null}
        {order.notes ? <p className="mt-2 text-sm font-medium">Obs: {order.notes}</p> : null}
      </section>

      <div className="mt-4 grid gap-2">
        <button type="button" className={btnGold} onClick={repeat}>Pedir de novo</button>
        {order.status === "received" || order.status === "awaiting_payment" ? (
          <button
            type="button"
            className={btnBrand}
            onClick={() =>
              void cancelMyOrder({ data: { id: order.id } })
                .then(() => getOrder({ data: { id } }).then(setData))
                .catch((reason) => toast.error(errorText(reason)))
            }
          >
            Cancelar pedido
          </button>
        ) : null}
      </div>
    </main>
  );
}
