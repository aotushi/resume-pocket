export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export async function ownerPrefix(userId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `resumes/${hash}/`;
}

export function isResumeId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export function safeFilename(rawName: string) {
  const name = rawName.replace(/[\u0000-\u001f\u007f/\\]/g, " ").trim();
  if (!/\.pdf$/i.test(name)) return null;
  return name.slice(0, 180).replace(/\.pdf$/i, "") + ".pdf";
}

export async function readBoundedPdf(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_RESUME_BYTES) throw new Error("文件不能超过 10 MB。");
  if (!request.body) throw new Error("请选择要上传的文件。");
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESUME_BYTES) {
        await reader.cancel();
        throw new Error("文件不能超过 10 MB。");
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("这不是有效的 PDF 文件，请检查后重试。");
  }
  return bytes;
}
