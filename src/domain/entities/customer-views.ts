import type { OrderStatus } from "./order";
import type { UserRole } from "./profile";

/**
 * Read models for the admin customer screens.
 *
 * Previously exported from `infrastructure/supabase/customer-service.ts`, which
 * made `CustomersTable.tsx` import its prop type from a Supabase module.
 */

export interface CustomerRow {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  createdAt: string;
  orderCount: number;
  /** Minor units. Excludes cancelled orders. */
  totalSpent: number;
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
