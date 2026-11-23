import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { claimStore, deleteAddress, joinStaff, listAddresses, updateProfile } from "@/lib/superbola/api";
import { DAY_NAMES, brl, errorText } from "@/lib/superbola/format";
import { useSession } from "./frame";
import { btnBrand, btnGold, card } from "./ui";
import { toast } from "sonner";

const subscribeNothing = () => () => {};

export function AccountPage() {
  const { me, catalog, refresh } = useSession();
  const [name, setName] = useState(me?.name ?? "");
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [code, setCode] = useState("");
  const [addresses, setAddresses] = useState<Awaited<ReturnType<typeof listAddresses>>>([]);
  const gate = useSyncExternalStore(subscribeNothing, hasGateSessionMarker, () => false);

  useEffect(() => {
    void listAddresses().then(setAddresses).catch(() => setAddresses([]));
  }, []);

  if (!me || !catalog) return null;
  return (
    <main className="px-4 py-4">
      <h1 className="text-2xl font-extrabold">Sua conta</h1>
      <p className="text-sm font-semibold text-gold">{me.email}</p>
      <form
        className="mt-4 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void updateProfile({ data: { name, phone } })
            .then(() => {
              toast.success("Dados salvos");
              refresh();
            })
            .catch((error) => toast.error(errorText(error)));
        }}
      >
        <input className="h-12 rounded-2xl bg-cream px-3 font-semibold text-ink" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" />
        <input className="h-12 rounded-2xl bg-cream px-3 font-semibold text-ink" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telefone" />
        <button className={btnGold} type="submit">Salvar</button>
      </form>

      <section className="mt-6">
        <h2 className="text-lg font-extrabold">Endereços</h2>
        <ul className="mt-2 space-y-2">
          {addresses.map((address) => (
            <li key={address.id} className={`${card} flex items-start justify-between gap-3`}>
              <p className="text-sm font-semibold">
                {address.label}: {address.street}, {address.number} — {address.neighborhood}
              </p>
              <button type="button" className="text-sm font-extrabold text-brand" onClick={() => void deleteAddress({ data: { id: address.id } }).then(() => listAddresses().then(setAddresses))}>
                Excluir
              </button>
            </li>
          ))}
          {addresses.length === 0 ? <li className="text-sm font-semibold">Nenhum endereço ainda. Você cadastra no fechamento do pedido.</li> : null}
        </ul>
      </section>

      <section className={`${card} mt-6`}>
        <h2 className="text-lg font-extrabold">Painel da pizzaria</h2>
        {me.role ? (
          <Link to="/admin" className={`${btnGold} mt-3`}>Abrir painel</Link>
        ) : (
          <div className="mt-3 grid gap-2">
            {!me.storeClaimed ? (
              <button
                type="button"
                className={btnGold}
                onClick={() => void claimStore().then(() => { toast.success("Você é o proprietário"); refresh(); }).catch((error) => toast.error(errorText(error)))}
              >
                Assumir a loja
              </button>
            ) : (
              <p className="text-sm font-semibold">A loja já tem proprietário. Entre com o código da equipe.</p>
            )}
            <div className="flex gap-2">
              <input className="h-12 flex-1 rounded-2xl bg-cream-2 px-3 font-semibold" placeholder="Código da equipe" value={code} onChange={(event) => setCode(event.target.value)} />
              <button type="button" className="rounded-2xl bg-brand px-4 font-extrabold text-cream" onClick={() => void joinStaff({ data: { code } }).then(() => { toast.success("Acesso liberado"); refresh(); }).catch((error) => toast.error(errorText(error)))}>
                Entrar
              </button>
            </div>
          </div>
        )}
      </section>

      {gate ? null : (
        <button type="button" className={`${btnBrand} mt-6`} onClick={() => void signOut().catch(() => toast.error("Não foi possível sair."))}>
          Sair da conta
        </button>
      )}
    </main>
  );
}

export function ContactPage() {
  const { catalog } = useSession();
  if (!catalog) return null;
  const { store } = catalog;
  const whats = store.whatsapp.replace(/\D/g, "");
  return (
    <main className="px-4 py-4">
      <h1 className="text-2xl font-extrabold">Contato</h1>
      <img src="/brand/mascote.png" alt="" className="mt-4 h-28 w-28 rounded-3xl object-cover" />
      <div className={`${card} mt-4 space-y-2 text-sm font-semibold`}>
        <p className="text-lg font-extrabold">{store.name}</p>
        <p>{store.phone ? `Telefone ${store.phone}` : "Telefone ainda não cadastrado."}</p>
        <p>{store.addressLine ? `${store.addressLine} — ${store.city}/${store.state}` : "Endereço da loja ainda não cadastrado."}</p>
        <p>Preparo médio {store.prepMinutes} min · retirada {store.pickupMinutes} min</p>
        {store.minOrderCents > 0 ? <p>Pedido mínimo {brl(store.minOrderCents)}</p> : <p>Sem pedido mínimo no momento.</p>}
        {whats ? (
          <a className="inline-flex font-extrabold text-brand" href={`https://wa.me/55${whats}`}>Chamar no WhatsApp</a>
        ) : (
          <p>WhatsApp ainda não cadastrado.</p>
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {store.hours.map((hour) => (
          <li key={hour.day} className="flex justify-between text-sm font-bold">
            <span>{DAY_NAMES[hour.day]}</span>
            <span>{hour.closed ? "Fechado" : `${hour.open} – ${hour.close}`}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm font-semibold text-gold">Status agora: {catalog.open.label}</p>
    </main>
  );
}
