import { env } from "cloudflare:workers";
import { isResumeId } from "./resume-policy";

export { isResumeId, isSameOrigin, ownerPrefix, readBoundedPdf, safeFilename } from "./resume-policy";

export type Resume = {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
};

export function getBucket() {
  if (!env.BUCKET) throw new Error("Resume storage is not configured");
  return env.BUCKET;
}

export function resumeFromObject(object: R2Object): Resume | null {
  const id = object.key.split("/").pop()?.replace(/\.pdf$/, "") ?? "";
  if (!isResumeId(id)) return null;
  let name = "简历.pdf";
  try {
    name = decodeURIComponent(object.customMetadata?.name ?? "") || name;
  } catch {
    // A malformed metadata value must not make the entire list unusable.
  }
  return { id, name, size: object.size, uploadedAt: object.uploaded.toISOString() };
}
