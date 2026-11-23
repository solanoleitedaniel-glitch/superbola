import { createFileRoute } from "@tanstack/react-router";
import { CartPage } from "@/components/sb/checkout";

export const Route = createFileRoute("/carrinho")({ component: CartPage });
