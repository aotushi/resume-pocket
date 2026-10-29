import { getCurrentUser } from "../../../lib/auth";
import { getBucket, isResumeId, isSameOrigin, ownerPrefix, resumeFromObject } from "../../../lib/resumes";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
  const { id } = await params;
  if (!isResumeId(id)) return Response.json({ error: "未找到这份简历。" }, { status: 404 });

  try {
    const object = await getBucket().get(`${await ownerPrefix(user.id)}${id}.pdf`);
    if (!object) return Response.json({ error: "未找到这份简历。" }, { status: 404 });
    const name = resumeFromObject(object)?.name ?? "resume.pdf";
    const download = new URL(request.url).searchParams.has("download");
    const encodedName = encodeURIComponent(name).replace(/['()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return new Response(object.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(object.size),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="resume.pdf"; filename*=UTF-8''${encodedName}`,
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
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源不正确。" }, { status: 403 });
  const { id } = await params;
  if (!isResumeId(id)) return Response.json({ error: "未找到这份简历。" }, { status: 404 });
  try {
    await getBucket().delete(`${await ownerPrefix(user.id)}${id}.pdf`);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Could not delete resume", error);
    return Response.json({ error: "删除失败，请稍后重试。" }, { status: 500 });
  }
}
