import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/sb/shop";

export const Route = createFileRoute("/")({ component: HomePage });
