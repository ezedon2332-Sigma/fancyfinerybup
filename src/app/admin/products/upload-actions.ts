"use server";

import { requireAdmin } from "@/infrastructure/auth/session";
import {
  presignUpload,
  type PresignedUpload,
} from "@/infrastructure/storage/media-storage";

/**
 * Issue a presigned upload URL for product media.
 *
 * This is the authorization point for the whole upload path. Previously the
 * browser held a Supabase key and wrote to Storage directly, with an RLS policy
 * on `storage.objects` (`bucket_id = 'product-images' AND is_admin()`) deciding
 * whether the write was allowed. That policy is gone, so the check has to be
 * here — and it must run BEFORE a URL is minted, because once minted the URL
 * carries the server's own credentials and anyone holding it can write.
 *
 * `requireAdmin()` redirects non-admins, so reaching the presign call at all
 * means the caller is an admin.
 */
export async function createUploadUrl(input: {
  contentType: string;
  sizeBytes: number;
}): Promise<PresignedUpload | { error: string }> {
  await requireAdmin();

  if (
    typeof input?.contentType !== "string" ||
    typeof input?.sizeBytes !== "number"
  ) {
    return { error: "Invalid upload request." };
  }

  return presignUpload({
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  });
}
