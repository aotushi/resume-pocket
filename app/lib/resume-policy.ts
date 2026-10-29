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

/** 支持的原件格式：PDF 直接预览，Word 转换为 PDF 后预览 */
export type SourceType = "pdf" | "docx" | "doc";

export const SOURCE_MIME: Record<SourceType, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

export function sourceTypeOf(name: string): SourceType | null {
  const ext = /\.(pdf|docx|doc)$/i.exec(name)?.[1].toLowerCase();
  return ext === "pdf" || ext === "docx" || ext === "doc" ? ext : null;
}

export function safeFilename(rawName: string) {
  const name = rawName.replace(/[\u0000-\u001f\u007f/\\]/g, " ").trim();
  const type = sourceTypeOf(name);
  if (!type) return null;
  return name.slice(0, 180).replace(/\.(pdf|docx|doc)$/i, "") + "." + type;
}

// 文件头魔数：PDF 为 %PDF-，DOCX 是 ZIP 包，DOC 是 OLE 复合文档
const MAGIC: Record<SourceType, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d],
  docx: [0x50, 0x4b, 0x03, 0x04],
  doc: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
};

export function hasMagic(bytes: Uint8Array, type: SourceType) {
  return MAGIC[type].every((byte, index) => bytes[index] === byte);
}

export async function readBoundedFile(request: Request, type: SourceType) {
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
  if (!hasMagic(bytes, type)) {
    throw new Error(type === "pdf" ? "这不是有效的 PDF 文件，请检查后重试。" : "这不是有效的 Word 文件，请检查后重试。");
  }
  return bytes;
}
