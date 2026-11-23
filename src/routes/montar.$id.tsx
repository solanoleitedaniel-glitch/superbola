import { createFileRoute } from "@tanstack/react-router";
import { BuilderPage } from "@/components/sb/shop";

export const Route = createFileRoute("/montar/$id")({ component: BuilderPage });
