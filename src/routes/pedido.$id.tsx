import { createFileRoute } from "@tanstack/react-router";
import { OrderPage } from "@/components/sb/checkout";

export const Route = createFileRoute("/pedido/$id")({ component: OrderPage });
