import { resolveOwner } from "../../../lib/owner";
import { getBucket, isResumeId, isSameOrigin, resumeFromObject, SOURCE_MIME } from "../../../lib/resumes";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * 默认内联返回 PDF（预览、打印）；`?download` 下载原件（Word 简历即 Word 原件），
 * `?download=pdf` 始终下载 PDF 版本。
 */
export async function GET(request: Request, { params }: Context) {
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录。" }, { status: 401 });
  const { id } = await params;
  if (!isResumeId(id)) return Response.json({ error: "未找到这份简历。" }, { status: 404 });

  try {
    const bucket = getBucket();
    const object = await bucket.get(`${owner.prefix}${id}.pdf`);
    const resume = object && resumeFromObject(object, owner.kind);
    if (!object || !resume) return Response.json({ error: "未找到这份简历。" }, { status: 404 });
    const download = new URL(request.url).searchParams.get("download");
    const wantOriginal = download !== null && download !== "pdf" && resume.source !== "pdf";
    const file = wantOriginal ? await bucket.get(`${owner.prefix}${id}.${resume.source}`) : object;
    if (!file) return Response.json({ error: "未找到这份简历的原件。" }, { status: 404 });
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
  } catch (error) {
    console.error("Could not read resume", error);
    return Response.json({ error: "暂时无法打开简历，请稍后重试。" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源不正确。" }, { status: 403 });
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录。" }, { status: 401 });
  const { id } = await params;
  if (!isResumeId(id)) return Response.json({ error: "未找到这份简历。" }, { status: 404 });
  try {
    // 连同可能存在的 Word 原件一起删除
    await getBucket().delete(["pdf", "docx", "doc"].map((ext) => `${owner.prefix}${id}.${ext}`));
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Could not delete resume", error);
    return Response.json({ error: "删除失败，请稍后重试。" }, { status: 500 });
  }
}
