import { createFileRoute } from "@tanstack/react-router";
import { AdminSettingsPage } from "@/components/sb/admin";

export const Route = createFileRoute("/admin/ajustes")({ component: AdminSettingsPage });
