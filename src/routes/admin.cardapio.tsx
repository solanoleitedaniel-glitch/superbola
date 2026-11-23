import { createFileRoute } from "@tanstack/react-router";
import { AdminMenuPage } from "@/components/sb/admin";

export const Route = createFileRoute("/admin/cardapio")({ component: AdminMenuPage });
