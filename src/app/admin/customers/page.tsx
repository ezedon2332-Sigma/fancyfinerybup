import type { Metadata } from "next";

import { CustomersTable } from "@/components/admin/CustomersTable";
import { listCustomers } from "@/infrastructure/supabase/customer-service";
import { getCurrentUser } from "@/infrastructure/supabase/auth";

export const metadata: Metadata = { title: "Admin · Customers" };

export default async function AdminCustomersPage() {
  const [customers, me] = await Promise.all([listCustomers(), getCurrentUser()]);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Customers</h1>
      <CustomersTable customers={customers} currentUserId={me?.id ?? ""} />
    </div>
  );
}
