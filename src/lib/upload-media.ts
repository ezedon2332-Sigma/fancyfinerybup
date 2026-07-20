"use client";

import * as tus from "tus-js-client";

import { publicEnv } from "@/config/env";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser-client";

/**
 * Browser → Supabase Storage upload using RESUMABLE (TUS) uploads.
 *
 * Resumable/chunked uploads are Supabase's recommended path for anything larger
 * than a few MB (i.e. videos): they upload in 6 MB chunks, automatically retry
 * on network hiccups, and expose real progress — far more reliable than a single
 * large request. The admin's session JWT authorises the write (storage RLS).
 */

const BUCKET = "product-images";
// Supabase requires resumable chunks of exactly 6 MB (except the final chunk).
const CHUNK_SIZE = 6 * 1024 * 1024;

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
  const objectName = `products/${crypto.randomUUID()}.${ext}`;

  let upload: tus.Upload | null = null;

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

        upload = new tus.Upload(file, {
          endpoint: `${publicEnv.supabaseUrl}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${token}`,
            apikey: publicEnv.supabasePublishableKey,
            "x-upsert": "false",
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: CHUNK_SIZE,
          metadata: {
            bucketName: BUCKET,
            objectName,
            contentType,
            cacheControl: "3600",
          },
          onError: (error) => {
            const anyErr = error as { originalResponse?: { getStatus?: () => number } };
            const status = anyErr?.originalResponse?.getStatus?.();
            reject(
              new Error(
                status === 413
                  ? "That file exceeds the server upload limit."
                  : error?.message || "Upload failed. Please try again.",
              ),
            );
          },
          onProgress: (uploaded, total) => {
            if (total > 0) onProgress(Math.round((uploaded / total) * 100));
          },
          onSuccess: () => {
            onProgress(100);
            resolve({ path: objectName, mediaType: kind });
          },
        });

        upload
          .findPreviousUploads()
          .then((prev) => {
            if (prev.length > 0) upload!.resumeFromPreviousUpload(prev[0]);
            upload!.start();
          })
          .catch(() => upload!.start());
      })
      .catch(reject);
  });

  return {
    promise,
    abort: () => {
      void upload?.abort(true);
    },
  };
}
