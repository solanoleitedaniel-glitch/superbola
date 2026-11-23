import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/components/sb/account";

export const Route = createFileRoute("/contato")({ component: ContactPage });
