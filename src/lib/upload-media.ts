"use client";

import { publicEnv } from "@/config/env";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";

/**
 * Direct browser → Supabase Storage upload with real progress.
 *
 * The admin's own session JWT authorises the write (the storage RLS policy
 * `is_admin()` gates inserts), so no server round-trip is needed and we can
 * stream `xhr.upload.onprogress` into a per-file progress bar.
 */

const BUCKET = "product-images";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB (covers short videos)

export type MediaType = "image" | "video";

export interface UploadResult {
  path: string;
  mediaType: MediaType;
}

export interface UploadHandle {
  promise: Promise<UploadResult>;
  abort: () => void;
}

/** Returns an error string if the file is not an allowed image/video, else null. */
export function validateMediaFile(file: File): string | null {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) return "Only image or video files are allowed.";
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `Too large (${mb}MB). Max is 50MB.`;
  }
  return null;
}

function extensionFor(file: File, isVideo: boolean): string {
  return (file.name.split(".").pop() || (isVideo ? "mp4" : "jpg"))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Start an upload. Returns a handle exposing the result promise and an
 * `abort()` to cancel an in-flight transfer.
 */
export function uploadMediaWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): UploadHandle {
  const isVideo = file.type.startsWith("video/");
  const path = `products/${crypto.randomUUID()}.${extensionFor(file, isVideo)}`;
  const xhr = new XMLHttpRequest();

  const promise = new Promise<UploadResult>((resolve, reject) => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const token = data.session?.access_token;
        if (!token) {
          reject(new Error("Your session expired — sign in again."));
          return;
        }

        const endpoint = `${publicEnv.supabaseUrl}/storage/v1/object/${BUCKET}/${path}`;
        xhr.open("POST", endpoint);
        xhr.setRequestHeader("authorization", `Bearer ${token}`);
        xhr.setRequestHeader("apikey", publicEnv.supabasePublishableKey);
        xhr.setRequestHeader("x-upsert", "false");
        if (file.type) xhr.setRequestHeader("content-type", file.type);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress(100);
            resolve({ path, mediaType: isVideo ? "video" : "image" });
          } else {
            let msg = `Upload failed (${xhr.status}).`;
            try {
              const body = JSON.parse(xhr.responseText);
              msg = body.message || body.error || msg;
            } catch {
              /* non-JSON error body */
            }
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.onabort = () => reject(new Error("Upload cancelled."));
        xhr.send(file);
      })
      .catch(reject);
  });

  return { promise, abort: () => xhr.abort() };
}
