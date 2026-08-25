import {
  getCurrentProfile,
  getCurrentUser,
} from "@/infrastructure/auth/session";
import { listCategories } from "@/application/use-cases/catalog";
import { getCatalogDeps } from "@/infrastructure/db/catalog-service";
import { rethrowFrameworkErrors } from "@/lib/rethrow-framework-errors";
import { Navbar } from "./Navbar";

/**
 * Server wrapper: resolves auth state (+ first name) and the live collection
 * list, then renders the navbar.
 *
 * The collections come from the database rather than a hardcoded array. The
 * navbar previously shipped fixed Men / Women / Children links pointing at
 * `?category=men` and so on — categories that need not exist, so those links
 * could lead to an empty page for a collection the store does not sell. Reading
 * the real categories means the menu can only ever offer what an admin created.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const profile = user ? await getCurrentProfile() : null;
  const firstName = profile?.fullName?.trim()?.split(" ")[0] ?? null;

  // A catalogue outage must not take the header — and therefore every page —
  // down with it. Worst case the menu shows "Collections" with no children.
  let collections: { slug: string; name: string }[] = [];
  try {
    const cats = await listCategories(await getCatalogDeps());
    collections = cats.map((c) => ({ slug: c.slug, name: c.name }));
  } catch (e) {
    rethrowFrameworkErrors(e);
    console.error("[header] categories unavailable", e);
  }

  return (
    <Navbar
      user={user ? { email: user.email, firstName } : null}
      collections={collections}
    />
  );
}
