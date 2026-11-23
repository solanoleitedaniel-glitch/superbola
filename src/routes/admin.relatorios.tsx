import { createFileRoute } from "@tanstack/react-router";
import { AdminReportPage } from "@/components/sb/admin";

export const Route = createFileRoute("/admin/relatorios")({ component: AdminReportPage });
