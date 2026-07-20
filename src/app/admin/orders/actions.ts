"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";
import { ORDER_STATUSES, type OrderStatus } from "@/domain/entities/order";
import { generateTrackingNumber } from "@/domain/shipping/tracking";
import { isShipped } from "@/lib/order-status";
import { notifyOrderStatusChanged } from "@/infrastructure/notifications/email";

const statusSchema = z.enum(ORDER_STATUSES as unknown as [string, ...string[]]);

export interface OrderActionResult {
  ok: boolean;
  error?: string;
}

export async function updateOrderStatus(
  id: string,
  status: string,
): Promise<OrderActionResult> {
  await requireAdmin();
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Invalid status." };
  const nextStatus = parsed.data as OrderStatus;

  const supabase = await createSupabaseServerClient();

  // Only generate a tracking number once, on the first transition into shipping.
  const { data: existing } = await supabase
    .from("orders")
    .select("tracking_number")
    .eq("id", id)
    .maybeSingle();

  const needsTracking = isShipped(nextStatus) && !existing?.tracking_number;

  if (needsTracking) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus, tracking_number: generateTrackingNumber() })
        .eq("id", id);
      if (!error) break;
      const collision = /tracking_number|duplicate|unique/i.test(error.message);
      if (!collision) return { ok: false, error: error.message };
      if (attempt === 4) {
        return { ok: false, error: "Could not assign a tracking number. Try again." };
      }
    }
  } else {
    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  }

  await notifyOrderStatusChanged(id, nextStatus);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/account/orders");
  return { ok: true };
}
