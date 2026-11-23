import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/components/sb/checkout";

export const Route = createFileRoute("/pedidos")({ component: OrdersPage });
