import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/sb/shop";

export const Route = createFileRoute("/produto/$id")({ component: ProductPage });
