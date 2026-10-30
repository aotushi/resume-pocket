import { resolveOwner } from "../../../lib/owner";
import { deleteLinksForResume } from "../../../lib/shares";
import { getBucket, isResumeId, isSameOrigin, resumeFileResponse, resumeFromObject } from "../../../lib/resumes";

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
    return await resumeFileResponse(owner.prefix, resume, new URL(request.url).searchParams.get("download"));
  } catch (error) {
    console.error("Could not read resume", error);
    return Response.json({ error: "暂时无法打开简历，请稍后重试" }, { status: 500 });
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
