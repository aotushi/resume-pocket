import { guestRateLimited, resolveOwner } from "../../../lib/owner";
import { deleteLinksForResume } from "../../../lib/shares";
import { FORMAT_ERROR, GUEST_FORMAT_ERROR } from "../../../lib/format-copy";
import { getBucket, isResumeId, isSameOrigin, readUpload, resumeFileResponse, resumeFromObject, saveResume, uploadName } from "../../../lib/resumes";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * 默认内联返回 PDF（预览、打印）；`?download` 下载原件（Word 简历即 Word 原件），
 * `?download=pdf` 始终下载 PDF 版本。
 */
export async function GET(request: Request, { params }: Context) {
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;
  if (!isResumeId(id)) return Response.json({ error: "未找到这份简历" }, { status: 404 });

  try {
    const object = await getBucket().head(`${owner.prefix}${id}.pdf`);
    const resume = object && resumeFromObject(object, owner.kind);
    if (!resume) return Response.json({ error: "未找到这份简历" }, { status: 404 });
    return await resumeFileResponse(owner.prefix, resume, request, true);
  } catch (error) {
    console.error("Could not read resume", error);
    return Response.json({ error: "暂时无法打开简历，请稍后重试" }, { status: 500 });
  }
}

/**
 * 替换简历文件：id 不变，已发出的分享链接随之显示新版本；文件名与格式以新文件为准。
 * 规则同上传：游客只能换成 PDF，Word 转换失败则保留原文件不动。
 */
export async function PUT(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源不正确" }, { status: 403 });
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;
  if (!isResumeId(id)) return Response.json({ error: "未找到这份简历" }, { status: 404 });

  const named = uploadName(request);
  if (!named) return Response.json({ error: FORMAT_ERROR }, { status: 400 });
  if (owner.kind === "guest") {
    if (named.type !== "pdf") return Response.json({ error: GUEST_FORMAT_ERROR }, { status: 400 });
    if (await guestRateLimited(request)) return Response.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
  }

  try {
    const current = await getBucket().head(`${owner.prefix}${id}.pdf`);
    const resume = current && resumeFromObject(current, owner.kind);
    if (!resume) return Response.json({ error: "未找到这份简历" }, { status: 404 });
    const upload = await readUpload(request, named.type);
    if (upload instanceof Response) return upload;
    const object = await saveResume(owner.prefix, id, { ...named, ...upload }, resume);
    return Response.json({ resume: resumeFromObject(object, owner.kind) });
  } catch (error) {
    console.error("Could not replace resume", error);
    return Response.json({ error: "替换失败，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源不正确" }, { status: 403 });
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;
  if (!isResumeId(id)) return Response.json({ error: "未找到这份简历" }, { status: 404 });
  try {
    // 连同可能存在的 Word 原件一起删除
    await getBucket().delete(["pdf", "docx", "doc"].map((ext) => `${owner.prefix}${id}.${ext}`));
    // 再清理分享记录：即使这一步失败，公开访问也会因找不到简历而失效
    await deleteLinksForResume(owner.prefix, id).catch((error) => console.error("Could not delete share links", error));
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Could not delete resume", error);
    return Response.json({ error: "删除失败，请稍后重试" }, { status: 500 });
  }
}
