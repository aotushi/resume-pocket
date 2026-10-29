import { env } from "cloudflare:workers";
import { guestDeleteAt, isGuestExpired } from "./guest-policy";
import type { Owner } from "./owner";
import { hasMagic, isResumeId, SOURCE_MIME, type SourceType, sourceTypeOf } from "./resume-policy";

export { isResumeId, isSameOrigin, ownerPrefix, readBoundedFile, safeFilename, SOURCE_MIME, sourceTypeOf, type SourceType } from "./resume-policy";

/**
 * 存储约定：每份简历都有 `{前缀}{id}.pdf`，用于预览、打印和列表；
 * Word 简历另存原件 `{前缀}{id}.docx|.doc`，下载默认给原件。列表只认 .pdf 对象。
 */
export type Resume = {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  /** 原件格式：pdf 直接预览；docx/doc 预览的是转换后的 PDF */
  source: SourceType;
  /** 仅游客简历有：到达该时间后自动删除 */
  deleteAt?: string;
};

export function getBucket() {
  if (!env.BUCKET) throw new Error("Resume storage is not configured");
  return env.BUCKET;
}

export function resumeFromObject(object: R2Object, kind: Owner["kind"] = "user"): Resume | null {
  if (!object.key.endsWith(".pdf")) return null;
  const id = object.key.split("/").pop()?.replace(/\.pdf$/, "") ?? "";
  if (!isResumeId(id)) return null;
  // 游客简历过了保留期即视为不存在，即使生命周期规则尚未真正删除
  if (kind === "guest" && isGuestExpired(object.uploaded)) return null;
  let name = "简历.pdf";
  try {
    name = decodeURIComponent(object.customMetadata?.name ?? "") || name;
  } catch {
    // A malformed metadata value must not make the entire list unusable.
  }
  const source = sourceTypeOf(`.${object.customMetadata?.source ?? "pdf"}`) ?? "pdf";
  const resume: Resume = { id, name, size: object.size, uploadedAt: object.uploaded.toISOString(), source };
  if (kind === "guest") resume.deleteAt = guestDeleteAt(object.uploaded).toISOString();
  return resume;
}

export async function listResumes(owner: Owner) {
  const bucket = getBucket();
  const resumes: Resume[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: owner.prefix, cursor, include: ["customMetadata"] });
    resumes.push(...page.objects.map((object) => resumeFromObject(object, owner.kind)).filter((item) => item !== null));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return resumes.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** 调用 WordConverter 容器把 Word 转成 PDF；任何失败都抛错，由调用方整体放弃这次上传 */
export async function convertWordToPdf(bytes: Uint8Array, type: Exclude<SourceType, "pdf">) {
  // 仅本地开发：.dev.vars 里的 WORD_CONVERTER_URL 直连手动启动的转换容器；线上不设置，走容器绑定
  const devUrl = env.WORD_CONVERTER_URL;
  if (!devUrl && !env.WORD_CONVERTER) throw new Error("Word converter is not configured");
  const target = devUrl ? { fetch } : env.WORD_CONVERTER.get(env.WORD_CONVERTER.idFromName("converter"));
  const response = await target.fetch(devUrl ? `${devUrl}/convert` : "http://converter/convert", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "X-Source-Type": type },
    body: bytes as Uint8Array<ArrayBuffer>,
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Conversion failed with status ${response.status}`);
  const pdf = new Uint8Array(await response.arrayBuffer());
  if (!hasMagic(pdf, "pdf")) throw new Error("Converter returned an invalid PDF");
  return pdf;
}

/**
 * 返回简历文件：默认内联 PDF（预览、打印）；`download` 非空时作为附件下载原件（Word 简历即 Word 原件），
 * `download === "pdf"` 始终下载 PDF 版本。所有者接口与分享接口共用。
 */
export async function resumeFileResponse(prefix: string, resume: Resume, download: string | null) {
  const bucket = getBucket();
  const wantOriginal = download !== null && download !== "pdf" && resume.source !== "pdf";
  const file = await bucket.get(`${prefix}${resume.id}.${wantOriginal ? resume.source : "pdf"}`);
  if (!file) return Response.json({ error: "未找到这份简历的文件。" }, { status: 404 });
  const ext = wantOriginal ? resume.source : "pdf";
  const name = resume.name.replace(/\.(pdf|docx|doc)$/i, "") + `.${ext}`;
  const encodedName = encodeURIComponent(name).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return new Response(file.body, {
    headers: {
      "Content-Type": SOURCE_MIME[ext],
      "Content-Length": String(file.size),
      "Content-Disposition": `${download !== null ? "attachment" : "inline"}; filename="resume.${ext}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
