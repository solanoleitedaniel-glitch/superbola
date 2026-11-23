import { createFileRoute } from "@tanstack/react-router";
import { CheckoutPage } from "@/components/sb/checkout";

export const Route = createFileRoute("/checkout")({ component: CheckoutPage });
