import { DEMO_USER_ID } from "./demo-id";

/** Garante que o visitante da demonstração enxerga o app e o painel. */
export async function ensureDemoVisitor() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`
    insert into profiles (user_id, name, phone)
    values (${DEMO_USER_ID}, '', '')
    on conflict (user_id) do nothing
  `;
  await sql`
    insert into staff (user_id, role)
    values (${DEMO_USER_ID}, 'staff')
    on conflict (user_id) do nothing
  `;
}
