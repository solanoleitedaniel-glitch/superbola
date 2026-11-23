import { createFileRoute } from "@tanstack/react-router";
import { PromosPage } from "@/components/sb/shop";

export const Route = createFileRoute("/promocoes")({ component: PromosPage });
