import { requireAdmin } from "@/infrastructure/supabase/auth";
import { listStatesForAdmin } from "@/infrastructure/supabase/nigeria-shipping-service";
import { NigeriaShippingPanel } from "@/components/admin/NigeriaShippingPanel";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Nigeria Shipping" };

// Always read live: an admin changing a fee expects to see it, and checkout is
// pricing from the same rows in real time.
export const dynamic = "force-dynamic";

export default async function AdminNigeriaShippingPage() {
  await requireAdmin();
  const states = await listStatesForAdmin();

  return (
    <div>
      <PageHeader
        eyebrow="Shipping"
        title="Nigeria Shipping"
        lead="Flat delivery fees by state and area. Independent of the international weight-based rates — changing anything here cannot affect a parcel going abroad."
      />
      <NigeriaShippingPanel states={states} />
    </div>
  );
}
