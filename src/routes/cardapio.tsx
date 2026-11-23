import { createFileRoute } from "@tanstack/react-router";
import { MenuPage } from "@/components/sb/shop";

export const Route = createFileRoute("/cardapio")({
  validateSearch: (search: Record<string, unknown>) => ({
    cat: typeof search.cat === "string" ? search.cat : "pizzas",
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: MenuPage,
});
