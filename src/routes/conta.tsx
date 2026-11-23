import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/sb/account";

export const Route = createFileRoute("/conta")({ component: AccountPage });
