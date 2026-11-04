import { SOURCE_MIME, type SourceType } from "./resume-policy.ts";

export type ResumeUpload = { name: string; type: SourceType; bytes: Uint8Array; pdf: Uint8Array };

export class ResumeConflictError extends Error {
  constructor() { super("简历已被其他操作更新或删除，请刷新后重试"); }
}

/** The PDF and its metadata are one atomic publication point. Never overwrite a published original. */
export async function saveResumeFiles(bucket: R2Bucket, prefix: string, id: string, upload: ResumeUpload, replacing?: { etag: string; createdAt: string }) {
  const version = crypto.randomUUID();
  if (upload.type !== "pdf") {
    await bucket.put(`${prefix}${id}/${version}.${upload.type}`, upload.bytes, {
      httpMetadata: { contentType: SOURCE_MIME[upload.type] },
    });
  }
  const object = await bucket.put(`${prefix}${id}.pdf`, upload.pdf, {
    onlyIf: replacing ? { etagMatches: replacing.etag } : { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      name: encodeURIComponent(upload.name), source: upload.type, version,
      createdAt: replacing?.createdAt ?? new Date().toISOString(),
      ...(upload.type !== "pdf" ? { originalVersion: version } : {}),
    },
  });
  if (!object) throw new ResumeConflictError();
  // Retain old originals for in-flight readers. Also retain a staged original if put throws:
  // a network error can arrive AFTER the PDF commit, so deleting it could break that commit.
  // All revisions (including abandoned stages) are removed when this resume is deleted.
  return object;
}

export function originalObjectKey(prefix: string, id: string, source: SourceType, metadata?: Record<string, string>) {
  const version = metadata?.originalVersion;
  if (version && /^[0-9a-f-]{36}$/i.test(version)) return `${prefix}${id}/${version}.${source}`;
  // Existing Word uploads continue to use their original fixed path until replaced.
  return `${prefix}${id}.${source}`;
}

export async function deleteResumeFiles(bucket: R2Bucket, prefix: string, id: string) {
  // Remove the publication point first. Conditional replacements cannot resurrect a deleted resume.
  await bucket.delete(`${prefix}${id}.pdf`);
  await bucket.delete([`${prefix}${id}.docx`, `${prefix}${id}.doc`]);
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: `${prefix}${id}/`, cursor });
    if (page.objects.length) await bucket.delete(page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
