"use client";

import { createUploadUrl } from "@/app/admin/products/upload-actions";

/**
 * Browser → object storage upload, via a presigned PUT.
 *
 * The server issues a short-lived URL (admin-gated, see upload-actions.ts) and
 * the browser PUTs the bytes straight to MinIO. Three things changed for the
 * better versus the old Supabase Storage path:
 *
 *  1. **Real progress.** `supabase-js`'s `upload()` resolved only on completion,
 *     so the old bar was a timer nudging itself to 90% and hoping. XHR reports
 *     actual bytes sent.
 *  2. **Real cancellation.** Aborting used to set a flag and then *delete the
 *     object afterwards* — the file uploaded in full regardless. `xhr.abort()`
 *     stops the transfer.
 *  3. **No 50 MB ceiling.** That was the Supabase project limit; the cap is now
 *     whatever MEDIA_MAX_VIDEO_MB says.
 */

// Client-side caps, mirrored from the server so an oversized file fails
// instantly instead of after a round trip. NOT a control: the authoritative
// limits are enforced in presignUpload() before a URL exists, and the signed
// ContentLength binds the URL to the approved size.
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export type MediaType = "image" | "video";

export interface UploadResult {
  path: string;
  mediaType: MediaType;
}

export interface UploadHandle {
  promise: Promise<UploadResult>;
  abort: () => void;
}

const VIDEO_EXT = ["mp4", "mov", "webm", "m4v", "ogv", "avi", "mkv", "3gp", "3g2"];
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "avif", "gif", "heic", "heif", "bmp"];

const EXT_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
};

function fileExt(file: File): string {
  return (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Classify a file as image/video using its MIME type, falling back to its
 *  extension (some browsers report an empty type for .mov/.mkv/etc.). */
export function mediaKind(file: File): MediaType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  const ext = fileExt(file);
  if (VIDEO_EXT.includes(ext)) return "video";
  if (IMAGE_EXT.includes(ext)) return "image";
  return null;
}

function resolveContentType(file: File, kind: MediaType): string {
  if (file.type) return file.type;
  const ext = fileExt(file);
  return EXT_MIME[ext] ?? (kind === "video" ? "video/mp4" : "image/jpeg");
}

/** Returns an error string if the file isn't an allowed image/video, else null. */
export function validateMediaFile(file: File): string | null {
  const kind = mediaKind(file);
  if (!kind) return "Only image or video files are allowed.";
  const cap = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > cap) {
    const mb = (file.size / (1024 * 1024)).toFixed(0);
    const capMb = Math.round(cap / (1024 * 1024));
    return `${kind === "video" ? "Video" : "Image"} is too large (${mb}MB). Max is ${capMb}MB.`;
  }
  return null;
}

export function uploadMediaWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): UploadHandle {
  const kind: MediaType = mediaKind(file) ?? "image";
  const contentType = resolveContentType(file, kind);

  let xhr: XMLHttpRequest | null = null;
  let cancelled = false;

  const promise = (async (): Promise<UploadResult> => {
    const signed = await createUploadUrl({
      contentType,
      sizeBytes: file.size,
    });
    if ("error" in signed) throw new Error(signed.error);
    if (cancelled) throw new Error("Upload cancelled.");

    onProgress(1);

    await new Promise<void>((resolve, reject) => {
      xhr = new XMLHttpRequest();
      xhr.open("PUT", signed.url, true);
      // Must match the signed Content-Type exactly, or the signature fails.
      xhr.setRequestHeader("Content-Type", signed.contentType);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        }
      };
      xhr.onload = () =>
        xhr && xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload failed (${xhr?.status ?? 0}).`));
      xhr.onerror = () => reject(new Error("Upload failed. Please try again."));
      xhr.onabort = () => reject(new Error("Upload cancelled."));
      xhr.send(file);
    });

    onProgress(100);
    return { path: signed.storagePath, mediaType: kind };
  })();

  return {
    promise,
    abort: () => {
      cancelled = true;
      xhr?.abort();
    },
  };
}
