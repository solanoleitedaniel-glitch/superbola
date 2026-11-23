import { createFileRoute } from "@tanstack/react-router";
import { AdminOrdersPage } from "@/components/sb/admin";

export const Route = createFileRoute("/admin/")({ component: AdminOrdersPage });
