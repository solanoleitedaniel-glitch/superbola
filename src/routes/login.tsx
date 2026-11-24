import { useState, type FormEvent } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-brand-deep text-cream">
        <p className="font-extrabold">Super Bola Pizzaria</p>
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result =
      mode === "up"
        ? await authClient.signUp.email({ email, password, name: name || "Cliente" })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "Não foi possível entrar.");
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 bg-brand-deep px-6 py-10 text-cream">
      <img src="/brand/mascote.png" alt="Super Bola Pizzaria" className="mx-auto h-36 w-36 rounded-3xl object-cover" />
      <div>
        <h1 className="text-3xl font-extrabold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
        <p className="mt-1 text-sm font-semibold text-gold">Seus pedidos ficam salvos nesta conta.</p>
      </div>
      {authEnabled ? (
        <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
          {mode === "up" ? (
            <input className="h-12 rounded-2xl bg-cream px-3 font-semibold text-ink" placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} required />
          ) : null}
          <input className="h-12 rounded-2xl bg-cream px-3 font-semibold text-ink" type="email" placeholder="E-mail" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <input className="h-12 rounded-2xl bg-cream px-3 font-semibold text-ink" type="password" placeholder="Senha" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error ? <p className="text-sm font-bold text-gold">{error}</p> : null}
          <button type="submit" disabled={busy} className="h-14 rounded-2xl bg-gold text-base font-extrabold text-ink disabled:opacity-60">
            {busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      ) : (
        <p className="text-sm font-semibold">O acesso está desligado.</p>
      )}
      <button type="button" className="text-sm font-extrabold text-gold" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "Ainda não tenho conta" : "Já tenho conta"}
      </button>
      <div className="grid gap-2">
        {GROK_PROVIDERS.map((provider) => (
          <button
            key={provider.providerId}
            type="button"
            className="h-12 rounded-2xl bg-brand font-extrabold"
            onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
          >
            Continuar com {provider.label}
          </button>
        ))}
      </div>
    </main>
  );
}
