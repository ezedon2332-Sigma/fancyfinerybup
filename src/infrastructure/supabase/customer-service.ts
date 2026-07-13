import "server-only";

import type { OrderStatus } from "@/domain/entities/order";
import type { UserRole } from "@/domain/entities/profile";
import { requireAdmin } from "./auth";
import { createSupabaseAdminClient } from "./admin-client";

export interface CustomerRow {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  createdAt: string;
  orderCount: number;
  totalSpent: number; // minor units, excludes cancelled
}

async function listAuthUsers() {
  const admin = createSupabaseAdminClient();
  const users: { id: string; email: string | null; created_at: string }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(
      ...data.users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
      })),
    );
    if (data.users.length < 200) break;
  }
  return users;
}

export async function listCustomers(): Promise<CustomerRow[]> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const [users, profilesRes, ordersRes] = await Promise.all([
    listAuthUsers(),
    admin.from("profiles").select("id, full_name, role"),
    admin.from("orders").select("user_id, total, status"),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (ordersRes.error) throw ordersRes.error;

  const profileById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p]),
  );
  const agg = new Map<string, { count: number; spent: number }>();
  for (const o of ordersRes.data ?? []) {
    const cur = agg.get(o.user_id) ?? { count: 0, spent: 0 };
    cur.count += 1;
    if ((o.status as OrderStatus) !== "cancelled") cur.spent += o.total;
    agg.set(o.user_id, cur);
  }

  return users
    .map((u) => {
      const p = profileById.get(u.id);
      const a = agg.get(u.id) ?? { count: 0, spent: 0 };
      return {
        id: u.id,
        email: u.email,
        fullName: p?.full_name ?? null,
        role: (p?.role ?? "customer") as UserRole,
        createdAt: u.created_at,
        orderCount: a.count,
        totalSpent: a.spent,
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export interface CustomerDetail {
  id: string;
  email: string | null;
  role: UserRole;
  fullName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  orders: {
    id: string;
    status: OrderStatus;
    total: number;
    currency: string;
    createdAt: string;
  }[];
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  await requireAdmin();
  const admin = createSupabaseAdminClient();

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(id);
  if (userErr || !userData?.user) return null;

  const [{ data: profile }, { data: orders }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", id).maybeSingle(),
    admin
      .from("orders")
      .select("id, status, total, currency, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return {
    id,
    email: userData.user.email ?? null,
    role: (profile?.role ?? "customer") as UserRole,
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    address: profile?.address ?? null,
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    country: profile?.country ?? null,
    lat: profile?.lat ?? null,
    lng: profile?.lng ?? null,
    createdAt: userData.user.created_at,
    orders: (orders ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      currency: o.currency,
      createdAt: o.created_at,
    })),
  };
}
