import { env } from "cloudflare:workers";
import { guestDeleteAt, isGuestExpired } from "./guest-policy";
import type { Owner } from "./owner";
import { hasMagic, isResumeId, readBoundedFile, safeFilename, SOURCE_MIME, type SourceType, sourceTypeOf } from "./resume-policy";

export { isResumeId, isSameOrigin, ownerPrefix, readBoundedFile, safeFilename, SOURCE_MIME, sourceTypeOf, type SourceType } from "./resume-policy";

/**
 * 存储约定：每份简历都有 `{前缀}{id}.pdf`，用于预览、打印和列表；
 * Word 简历另存原件 `{前缀}{id}.docx|.doc`，下载默认给原件。列表只认 .pdf 对象。
 */
export type Resume = {
  id: string;
  name: string;
  size: number;
  /** 最近一次上传或替换的时间 */
  uploadedAt: string;
  /** 首次上传时间：替换文件不改变它，游客保留期按它计算 */
  createdAt: string;
  /** 文件版本（R2 对象 etag）：替换文件后改变，拼进文件地址以便浏览器长期缓存 */
  version: string;
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
  // 替换文件会刷新 uploaded，保留期仍按首次上传时间算
  const createdAt = new Date(object.customMetadata?.createdAt ?? object.uploaded.toISOString());
  const created = Number.isNaN(createdAt.getTime()) ? object.uploaded : createdAt;
  // 游客简历过了保留期即视为不存在，即使生命周期规则尚未真正删除
  if (kind === "guest" && isGuestExpired(created)) return null;
  let name = "简历.pdf";
  try {
    name = decodeURIComponent(object.customMetadata?.name ?? "") || name;
  } catch {
    // A malformed metadata value must not make the entire list unusable.
  }
  const source = sourceTypeOf(`.${object.customMetadata?.source ?? "pdf"}`) ?? "pdf";
  const resume: Resume = { id, name, size: object.size, uploadedAt: object.uploaded.toISOString(), createdAt: created.toISOString(), version: object.etag, source };
  if (kind === "guest") resume.deleteAt = guestDeleteAt(created).toISOString();
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
 * 返回简历文件：默认内联 PDF（预览、打印）；`?download` 作为附件下载原件（Word 简历即 Word 原件），
 * `?download=pdf` 始终下载 PDF 版本。所有者接口与分享接口共用。
 *
 * 缓存：地址里的 `?v=` 与当前版本一致时，内容不会再变，可缓存一年（`allowLongCache`，仅所有者接口）；
 * 其余情况每次向服务器确认，未变化返回 304 不重传。分享接口必须走确认，停用或到期才能立即生效。
 */
export async function resumeFileResponse(prefix: string, resume: Resume, request: Request, allowLongCache: boolean) {
  const params = new URL(request.url).searchParams;
  const download = params.get("download");
  const bucket = getBucket();
  const wantOriginal = download !== null && download !== "pdf" && resume.source !== "pdf";
  const ext = wantOriginal ? resume.source : "pdf";
  const file = await bucket.get(`${prefix}${resume.id}.${ext}`, { onlyIf: request.headers });
  if (!file) return Response.json({ error: "未找到这份简历的文件" }, { status: 404 });
  const cacheControl = allowLongCache && params.get("v") === resume.version
    ? "private, max-age=31536000, immutable"
    : "private, no-cache";
  // If-None-Match 命中时 R2 不返回内容
  if (!("body" in file)) return new Response(null, { status: 304, headers: { ETag: file.httpEtag, "Cache-Control": cacheControl } });
  const name = resume.name.replace(/\.(pdf|docx|doc)$/i, "") + `.${ext}`;
  const encodedName = encodeURIComponent(name).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return new Response(file.body, {
    headers: {
      "Content-Type": SOURCE_MIME[ext],
      "Content-Length": String(file.size),
      "Content-Disposition": `${download !== null ? "attachment" : "inline"}; filename="resume.${ext}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": cacheControl,
      ETag: file.httpEtag,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

/** 上传请求头里的文件名与格式；不合法时为 null */
export function uploadName(request: Request) {
  let name: string | null = null;
  try {
    name = safeFilename(decodeURIComponent(request.headers.get("x-resume-name") ?? ""));
  } catch {
    // 与非法文件名同样处理
  }
  const type = name ? sourceTypeOf(name) : null;
  return name && type ? { name, type } : null;
}

/** 读取上传内容；Word 先转成 PDF。失败时返回可直接回给前端的错误响应 */
export async function readUpload(request: Request, type: SourceType): Promise<{ bytes: Uint8Array; pdf: Uint8Array } | Response> {
  let bytes: Uint8Array;
  try {
    bytes = await readBoundedFile(request, type);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "文件读取失败" }, { status: 400 });
  }
  if (type === "pdf") return { bytes, pdf: bytes };
  try {
    return { bytes, pdf: await convertWordToPdf(bytes, type) };
  } catch (error) {
    console.error("Could not convert Word resume", error);
    return Response.json({ error: "Word 转换失败，文件可能已损坏、加密或格式过旧，请在 Word 中另存为 DOCX 或 PDF 后重试" }, { status: 422 });
  }
}

/**
 * 写入一份简历：先存原件再存 PDF，列表只认 PDF，PDF 写入失败时不会出现缺原件的简历。
 * 替换已有简历时传入首次上传时间，并删掉格式不同的旧原件；PDF 写入失败则清理本次写入的原件。
 */
export async function saveResume(prefix: string, id: string, upload: { name: string; type: SourceType; bytes: Uint8Array; pdf: Uint8Array }, replacing?: Resume) {
  const bucket = getBucket();
  const originalKey = `${prefix}${id}.${upload.type}`;
  if (upload.type !== "pdf") await bucket.put(originalKey, upload.bytes, { httpMetadata: { contentType: SOURCE_MIME[upload.type] } });
  try {
    const object = await bucket.put(`${prefix}${id}.pdf`, upload.pdf, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: {
        name: encodeURIComponent(upload.name),
        source: upload.type,
        createdAt: replacing?.createdAt ?? new Date().toISOString(),
      },
    });
    if (replacing && replacing.source !== "pdf" && replacing.source !== upload.type) {
      await bucket.delete(`${prefix}${id}.${replacing.source}`).catch((error) => console.error("Could not delete old original", error));
    }
    return object;
  } catch (error) {
    // 替换同格式原件时旧原件已被覆盖，无法回滚；新原件留着也不影响预览（仍是旧 PDF）
    if (upload.type !== "pdf" && replacing?.source !== upload.type) await bucket.delete(originalKey).catch(() => undefined);
    throw error;
  }
}
