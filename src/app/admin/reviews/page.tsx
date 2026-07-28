import { MessageSquare, ShieldCheck, Star, TriangleAlert } from "lucide-react";

import { requireAdmin } from "@/infrastructure/supabase/auth";
import {
  listReviewsForAdmin,
  reviewCounts,
} from "@/infrastructure/supabase/review-service";
import { listProducts } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/supabase/catalog-service";
import { ReviewsModeration } from "@/components/admin/ReviewsModeration";
import { PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Reviews" };

// Moderation decisions must be visible immediately after they are made.
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;

  // Default to the pending queue: it is the only status that needs action.
  const effective = status ?? "pending";

  let reviews: Awaited<ReturnType<typeof listReviewsForAdmin>> = [];
  let counts = { pending: 0, approved: 0, rejected: 0, spam: 0 };
  let productNames: Record<string, string> = {};

  try {
    const deps = await getCatalogDeps();
    const [list, c, products] = await Promise.all([
      listReviewsForAdmin(effective || undefined),
      reviewCounts(),
      listProducts(deps),
    ]);
    reviews = list;
    counts = c;
    productNames = Object.fromEntries(products.map((p) => [p.id, p.name]));
  } catch (e) {
    // Reviews table not migrated yet — the panel shows its own empty state
    // rather than failing the route.
    console.error("[admin/reviews] unavailable", e);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Community"
        title="Reviews"
        lead="Nothing appears under a product until it is approved here. Approving recomputes that product's rating automatically."
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<MessageSquare className="h-4 w-4" />}
          label="Awaiting approval"
          value={counts.pending}
          sub={counts.pending > 0 ? "Needs your attention" : "Queue is clear"}
        />
        <Stat icon={<ShieldCheck className="h-4 w-4" />} label="Published" value={counts.approved} />
        <Stat icon={<Star className="h-4 w-4" />} label="Rejected" value={counts.rejected} />
        <Stat icon={<TriangleAlert className="h-4 w-4" />} label="Marked spam" value={counts.spam} />
      </div>

      <div className="mt-10">
        <ReviewsModeration
          reviews={reviews}
          productNames={productNames}
          activeStatus={effective}
        />
      </div>
    </div>
  );
}
