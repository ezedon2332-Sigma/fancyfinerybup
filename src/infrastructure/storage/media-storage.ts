import "server-only";

import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { publicEnv } from "@/config/env";
import { serverEnv } from "@/config/server-env";

/**
 * Object storage for product media (MinIO in dev and on the VPS; any
 * S3-compatible service without code changes).
 *
 * Uploads are **browser → storage directly**, via a short-lived presigned PUT.
 * The Next.js server issues the URL and never touches the bytes, so a 200 MB
 * video does not stream through the application container, hit a body-size
 * limit, or sit in its memory.
 *
 * Nothing outside this module imports the S3 SDK, which is what makes a later
 * move to R2 or S3 a change to these ~40 lines rather than a second migration.
 */

const s3 = new S3Client({
  region: serverEnv.s3Region,
  endpoint: serverEnv.s3Endpoint,
  // MinIO serves buckets as a path segment (`/product-media/products/x.jpg`),
  // not as a subdomain. Without this the SDK would address
  // `product-media.minio:9000`, which does not resolve.
  forcePathStyle: true,
  credentials: {
    accessKeyId: serverEnv.s3AccessKeyId,
    secretAccessKey: serverEnv.s3SecretAccessKey,
  },
});

/** How long a presigned upload URL stays valid. Long enough for a large video
 *  on a slow connection, short enough that a leaked URL is not a standing
 *  write grant. */
const UPLOAD_URL_TTL_SECONDS = 15 * 60;

export type MediaKind = "image" | "video";

export interface PresignedUpload {
  /** PUT the file here, with the exact Content-Type below. */
  url: string;
  /** Store this in `product_images.storage_path`. */
  storagePath: string;
  /** Must match what the browser sends, or the signature fails. */
  contentType: string;
}

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/bmp",
]);

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/ogg",
  "video/x-msvideo",
  "video/x-matroska",
  "video/3gpp",
  "video/3gpp2",
]);

/** Extension is derived from the MIME type, never from the client's filename —
 *  a filename is attacker-controlled and has no business naming a stored object. */
const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/x-msvideo": "avi",
  "video/x-matroska": "mkv",
  "video/3gpp": "3gp",
  "video/3gpp2": "3g2",
};

export function kindForContentType(contentType: string): MediaKind | null {
  if (IMAGE_TYPES.has(contentType)) return "image";
  if (VIDEO_TYPES.has(contentType)) return "video";
  return null;
}

export interface PresignError {
  error: string;
}

/**
 * Issue a presigned PUT for one file.
 *
 * Both checks here are the real ones. The matching validation in
 * `src/lib/upload-media.ts` runs in the browser purely so an oversized file
 * fails instantly instead of after an upload; it is not a control, because the
 * caller of a presigned URL chooses what to send.
 */
export async function presignUpload(input: {
  contentType: string;
  sizeBytes: number;
}): Promise<PresignedUpload | PresignError> {
  const kind = kindForContentType(input.contentType);
  if (!kind) return { error: "Only image or video files are allowed." };

  const limit =
    kind === "video" ? serverEnv.maxVideoBytes : serverEnv.maxImageBytes;
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { error: "Invalid file size." };
  }
  if (input.sizeBytes > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return {
      error: `${kind === "video" ? "Video" : "Image"} is too large. Max is ${mb}MB.`,
    };
  }

  const ext = EXT_FOR_TYPE[input.contentType] ?? "bin";
  // Immutable path: a replaced photo gets a new name and therefore a new URL,
  // which is what lets next/image cache these for 31 days safely.
  const storagePath = `products/${randomUUID()}.${ext}`;

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: serverEnv.s3Bucket,
      Key: storagePath,
      ContentType: input.contentType,
      // Signing the length binds the URL to this exact size, so it cannot be
      // reused to upload something far larger than was approved.
      ContentLength: input.sizeBytes,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

  return { url, storagePath, contentType: input.contentType };
}

/** Remove an object. Used when a product's media is detached. */
export async function deleteMedia(storagePath: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: serverEnv.s3Bucket,
      Key: storagePath,
    }),
  );
}

/** Public URL for a stored object. Mirrors `resolveMediaUrl` for server use. */
export function publicUrlFor(storagePath: string): string {
  return `${publicEnv.mediaUrl}/${storagePath.replace(/^\/+/, "")}`;
}
