import {
  getProfile,
  updateProfileDetails,
} from "@/infrastructure/db/profile-service";
import { profileSchema } from "@/lib/validation";

import { jsonBody, requireUser } from "../../../_lib/context";
import { fail, handler, ok } from "../../../_lib/respond";

/** GET /api/mobile/v1/account/profile — name, avatar and saved address. */
export const GET = handler(async () => {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return ok({
    id: user.id,
    email: user.email,
    fullName: profile?.fullName ?? user.name,
    avatarUrl: profile?.avatarUrl ?? null,
    // Exposed so the app can show the staff entry point to staff. It is NOT a
    // permission: every admin surface re-checks the role server-side, and this
    // field only decides whether a menu row is drawn.
    role: profile?.role ?? "customer",
    address: profile?.address ?? null,
  });
});

/**
 * PATCH /api/mobile/v1/account/profile — update name and saved address.
 *
 * Validated by the same `profileSchema` the website's account form uses, and
 * written scoped to the session's user id — never to an id from the body.
 */
export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();

  const body = await jsonBody(req);
  if (body === null) return fail("invalid_request", "Expected a JSON body.");

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(
      "invalid_request",
      issue?.message ?? "Invalid details.",
      issue?.path.join("."),
    );
  }
  const p = parsed.data;

  await updateProfileDetails(user.id, {
    fullName: p.fullName ?? null,
    phone: p.phone ?? null,
    address: p.address ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    country: p.country ?? null,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
  });

  const profile = await getProfile(user.id);
  return ok({
    id: user.id,
    email: user.email,
    fullName: profile?.fullName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    role: profile?.role ?? "customer",
    address: profile?.address ?? null,
  });
});
