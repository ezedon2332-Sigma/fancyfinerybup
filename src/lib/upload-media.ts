"use client";

import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";

/**
 * Browser → Supabase Storage upload using the official supabase-js client
 * (`storage.from().upload()`). This is the same client the app already uses for
 * auth/data, so the session, CORS and content-type are all handled correctly —
 * no custom headers or third-party upload libraries that can misbehave in the
 * browser. Works for images and videos alike (up to the project's size limit).
 */

const BUCKET = "product-images";

// The Supabase project upload ceiling is 50 MB (raise it in Storage settings to
// allow larger). Keep client caps at/under that so oversized files fail fast.
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB (project ceiling)

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
  const ext = fileExt(file) || (kind === "video" ? "mp4" : "jpg");
  const path = `products/${crypto.randomUUID()}.${ext}`;

  let cancelled = false;
  // Coarse progress: supabase-js upload() resolves on completion without
  // streaming progress, so we nudge the bar at start and finish at 100%.
  let timer: ReturnType<typeof setInterval> | null = null;

  const promise = (async (): Promise<UploadResult> => {
    const supabase = createSupabaseBrowserClient();

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error("Your session expired — please sign in again.");
    }

    // Animate the bar towards 90% while the upload is in flight.
    let pct = 5;
    onProgress(pct);
    timer = setInterval(() => {
      pct = Math.min(90, pct + 5);
      onProgress(pct);
    }, 400);

    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType, upsert: false });

      if (cancelled) {
        await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
        throw new Error("Upload cancelled.");
      }
      if (error) {
        throw new Error(error.message || "Upload failed. Please try again.");
      }
      onProgress(100);
      return { path, mediaType: kind };
    } finally {
      if (timer) clearInterval(timer);
    }
  })();

  return {
    promise,
    abort: () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    },
  };
}
