"use client";

import { publicEnv } from "@/config/env";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";

/**
 * Direct browser → Supabase Storage upload with real progress.
 *
 * The admin's own session JWT authorises the write (storage RLS gates inserts),
 * so no server round-trip is needed and we can stream `xhr.upload.onprogress`
 * into a per-file progress bar.
 */

const BUCKET = "product-images";

// Supabase project upload ceiling is 50MB (raise it in Storage settings to allow
// larger). Keep the client caps at/under that so oversized files fail fast.
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

/** Common extension → MIME (used when the browser leaves file.type blank). */
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

/** The content-type to store the object under (so videos play back correctly). */
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
        xhr.setRequestHeader("content-type", contentType);
        xhr.setRequestHeader("cache-control", "3600");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress(100);
            resolve({ path, mediaType: kind });
          } else {
            let msg = `Upload failed (${xhr.status}).`;
            try {
              const body = JSON.parse(xhr.responseText);
              msg = body.message || body.error || msg;
            } catch {
              /* non-JSON error body */
            }
            if (xhr.status === 413) {
              msg = "That file exceeds the server upload limit.";
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
