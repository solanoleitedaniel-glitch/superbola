import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeft,
  ClipboardList,
  Home,
  MessageCircle,
  Search,
  ShoppingCart,
  Tag,
} from "lucide-react";
import { Toaster } from "sonner";
import { getCatalog, getMe } from "@/lib/superbola/api";
import { cartCount, useCart } from "@/lib/superbola/cart";
import { errorText } from "@/lib/superbola/format";

export type Me = Awaited<ReturnType<typeof getMe>>;
export type CatalogData = Awaited<ReturnType<typeof getCatalog>>;

type SessionValue = {
  me: Me | null;
  catalog: CatalogData | null;
  error: string;
  refresh: () => void;
};

const SessionCtx = createContext<SessionValue | null>(null);

export function useSession() {
  const value = useContext(SessionCtx);
  if (!value) throw new Error("Sessão indisponível");
  return value;
}

function BootScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-deep px-6 text-center text-cream">
      <div>
        <img src="/brand/mascote.png" alt="" className="mx-auto h-28 w-28 rounded-3xl object-cover" />
        <p className="mt-4 text-lg font-extrabold">Super Bola Pizzaria</p>
        <p className="mt-1 text-sm font-semibold text-gold">Abrindo o forno…</p>
      </div>
    </main>
  );
}

function SessionGate({ children, admin }: { children: ReactNode; admin: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [me, setMe] = useState<Me | null>(null);
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);

  useEffect(() => {
    let live = true;
    setError("");
    Promise.all([getMe(), getCatalog()])
      .then(([nextMe, nextCatalog]) => {
        if (!live) return;
        setMe(nextMe);
        setCatalog(nextCatalog);
      })
      .catch((reason) => {
        if (live) setError(errorText(reason));
      });
    return () => {
      live = false;
    };
  }, [pathname, nonce]);

  if (error && !catalog) {
    return (
      <main className="mx-auto grid min-h-screen max-w-lg place-items-center bg-brand-deep px-6 text-center">
        <div>
          <p className="text-lg font-extrabold">Não foi possível abrir o cardápio.</p>
          <p className="mt-2 text-sm font-semibold text-gold">{error}</p>
          <button type="button" className="mt-4 rounded-2xl bg-gold px-4 py-3 font-extrabold text-ink" onClick={() => setNonce((value) => value + 1)}>
            Tentar de novo
          </button>
        </div>
      </main>
    );
  }

  if (!catalog || !me) return <BootScreen />;

  return (
    <SessionCtx.Provider value={{ me, catalog, error, refresh: () => setNonce((value) => value + 1) }}>
      <Toaster position="top-center" />
      <div className={admin ? "min-h-screen bg-cream text-ink" : "min-h-screen bg-brand-deep text-cream"}>
        <div className={`bg-gold px-4 py-2 text-center text-xs font-extrabold leading-snug text-ink ${admin ? "" : "sticky top-0 z-30"}`}>
          Demonstração sem senha.{" "}
          {admin ? (
            <Link to="/" className="underline">Voltar ao app do cliente</Link>
          ) : (
            <Link to="/admin" className="underline">Abrir o painel da pizzaria</Link>
          )}
        </div>
        <div className={admin ? "mx-auto min-h-screen max-w-5xl" : "mx-auto min-h-screen max-w-lg pb-24"}>
          {children}
        </div>
        {admin ? null : <BottomNav />}
      </div>
    </SessionCtx.Provider>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.startsWith("/login") || pathname.startsWith("/api")) return <>{children}</>;
  return <SessionGate admin={pathname.startsWith("/admin")}>{children}</SessionGate>;
}

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/cardapio", label: "Cardápio", icon: Search },
  { to: "/promocoes", label: "Promoções", icon: Tag },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/contato", label: "Contato", icon: MessageCircle },
] as const;

function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.startsWith("/montar") || pathname.startsWith("/checkout") || pathname.startsWith("/produto")) return null;
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-brand-ink bg-brand-deep/95 backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                search={item.to === "/cardapio" ? { cat: "pizzas", q: "" } : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${active ? "text-gold" : "text-cream/80"}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopBar({ title, backTo = "/" }: { title: string; backTo?: string }) {
  const lines = useCart((state) => state.lines);
  const count = cartCount(lines);
  return (
    <header className="no-print flex items-center gap-3 px-4 pt-4">
      <Link to={backTo} aria-label="Voltar" className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-cream">
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <h1 className="flex-1 text-center text-lg font-extrabold">{title}</h1>
      <Link to="/carrinho" aria-label="Carrinho" className="relative grid h-11 w-11 place-items-center rounded-2xl bg-brand text-cream">
        <ShoppingCart className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-extrabold text-ink">
            {count}
          </span>
        ) : null}
      </Link>
    </header>
  );
}
