import { FORMAT_ERROR, GUEST_FORMAT_ERROR } from "../../lib/format-copy";
import { GUEST_MAX_RESUMES, guestCookie, guestPrefix, newGuestKey } from "../../lib/guest-policy";
import { guestRateLimited, resolveOwner } from "../../lib/owner";
import {
  convertWordToPdf,
  getBucket,
  isSameOrigin,
  listResumes,
  readBoundedFile,
  resumeFromObject,
  safeFilename,
  SOURCE_MIME,
  sourceTypeOf,
} from "../../lib/resumes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录" }, { status: 401 });

  try {
    const resumes = await listResumes(owner);
    return Response.json({ resumes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not list resumes", error);
    return Response.json({ error: "暂时无法读取简历，请稍后重试" }, { status: 500 });
  }
}

/**
 * 已登录用户上传到自己的空间；未登录时作为游客上传，首次上传会创建游客空间并下发 Cookie。
 * Word 仅限注册用户：先转换成 PDF，转换成功才同时保存原件与 PDF，失败则什么都不保存。
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源不正确" }, { status: 403 });

  let name: string | null = null;
  try {
    name = safeFilename(decodeURIComponent(request.headers.get("x-resume-name") ?? ""));
  } catch {
    // Return the same message as for an invalid name.
  }
  const type = name ? sourceTypeOf(name) : null;
  if (!name || !type) return Response.json({ error: FORMAT_ERROR }, { status: 400 });

  let owner = await resolveOwner(request);
  let newKey: string | null = null;
  if (owner?.kind !== "user") {
    if (type !== "pdf") return Response.json({ error: GUEST_FORMAT_ERROR }, { status: 400 });
    if (await guestRateLimited(request)) return Response.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
    if (!owner) {
      newKey = newGuestKey();
      owner = { kind: "guest", prefix: await guestPrefix(newKey), key: newKey };
    } else if ((await listResumes(owner)).length >= GUEST_MAX_RESUMES) {
      return Response.json({ error: "游客空间只能保存 1 份简历，请先删除现有简历，或注册后保存多份" }, { status: 409 });
    }
  }

  let bytes: Uint8Array;
  try {
    bytes = await readBoundedFile(request, type);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "文件读取失败" }, { status: 400 });
  }

  let pdf = bytes;
  if (type !== "pdf") {
    try {
      pdf = await convertWordToPdf(bytes, type);
    } catch (error) {
      console.error("Could not convert Word resume", error);
      return Response.json({ error: "Word 转换失败，文件可能已损坏、加密或格式过旧，请在 Word 中另存为 DOCX 或 PDF 后重试" }, { status: 422 });
    }
  }

  const bucket = getBucket();
  const id = crypto.randomUUID();
  const originalKey = `${owner.prefix}${id}.${type}`;
  try {
    // 先存原件再存 PDF：列表只认 PDF，PDF 写入失败时不会出现缺原件的简历
    if (type !== "pdf") await bucket.put(originalKey, bytes, { httpMetadata: { contentType: SOURCE_MIME[type] } });
    const object = await bucket.put(`${owner.prefix}${id}.pdf`, pdf, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { name: encodeURIComponent(name), source: type },
    });
    const headers = newKey ? { "Set-Cookie": guestCookie(newKey, request) } : undefined;
    return Response.json({ resume: resumeFromObject(object, owner.kind) }, { status: 201, headers });
  } catch (error) {
    console.error("Could not save resume", error);
    if (type !== "pdf") await bucket.delete(originalKey).catch(() => undefined);
    return Response.json({ error: "保存失败，请稍后重试" }, { status: 500 });
  }
}
