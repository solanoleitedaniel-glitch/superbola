import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 bg-brand-deep px-6 py-10 text-cream">
      <img src="/brand/mascote.png" alt="Super Bola Pizzaria" className="mx-auto h-36 w-36 rounded-3xl object-cover" />
      <div>
        <h1 className="text-3xl font-extrabold">Demonstração aberta</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-gold">
          Não precisa de e-mail nem senha. Entre, monte uma pizza e abra o painel da loja.
        </p>
      </div>
      <Link to="/" className="inline-flex h-14 items-center justify-center rounded-2xl bg-gold text-base font-extrabold text-ink">
        Entrar na demonstração
      </Link>
      <Link to="/admin" className="inline-flex h-14 items-center justify-center rounded-2xl bg-brand text-base font-extrabold">
        Ir direto ao painel
      </Link>
    </main>
  );
}
