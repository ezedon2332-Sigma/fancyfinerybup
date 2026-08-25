"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/infrastructure/auth/session";
import {
  createAdminInvite,
  revokeAdminInvite,
} from "@/infrastructure/db/admin-invite-service";
import { sendEmail } from "@/infrastructure/notifications/email";
import { SITE_URL } from "@/lib/site";

export interface TeamActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

/**
 * Invite someone to become an admin.
 *
 * Replaces the old `admin_allowlist` table, whose entries were added by editing
 * a migration — no expiry, no revocation, and no record of who granted what.
 * An invite here is a row with an inviter, an expiry and an audit trail, and
 * the raw token exists only inside the emailed link.
 *
 * `requireAdmin()` is the whole security boundary: this endpoint mints admin
 * access, so an unguarded call would be a privilege-escalation hole.
 */
export async function inviteAdmin(input: unknown): Promise<TeamActionResult> {
  const me = await requireAdmin();

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }
  const email = parsed.data.email;

  try {
    const { token, expiresAt } = await createAdminInvite(email, me.id);
    const link = `${SITE_URL}/signup?invite=${encodeURIComponent(token)}`;

    const sent = await sendEmail({
      to: email,
      subject: "You've been invited to the Fancy Finery admin",
      text:
        `You have been invited to help run the Fancy Finery store.\n\n` +
        `Create your account here — the link expires on ` +
        `${expiresAt.toDateString()}:\n${link}\n\n` +
        `If you weren't expecting this, you can ignore it.`,
      html: `
<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;color:#1a1a1a">
  <h1 style="font-size:22px;font-weight:400;margin:0 0 16px">You've been invited</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
    You have been invited to help run the Fancy Finery store. Create your
    account with the button below — the link expires on
    ${expiresAt.toDateString()}.
  </p>
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 24px;font-size:14px;letter-spacing:.04em">Accept invitation</a>
  </p>
  <p style="font-size:12px;color:#777;line-height:1.6;margin:0">
    If the button does not work, paste this into your browser:<br>
    <span style="word-break:break-all">${link}</span>
  </p>
</div>`.trim(),
    });

    revalidatePath("/admin/team");

    // The invite row exists either way. Say plainly when the email did not go,
    // so the inviter can pass the link along instead of assuming it arrived.
    if (!sent.ok) {
      return {
        ok: true,
        message: `Invite created, but the email could not be sent (${sent.error ?? "unknown error"}). Share the link manually.`,
      };
    }
    return { ok: true, message: `Invitation sent to ${email}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function revokeInvite(id: string): Promise<TeamActionResult> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Invalid id." };
  try {
    await revokeAdminInvite(id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/admin/team");
  return { ok: true, message: "Invitation revoked." };
}
