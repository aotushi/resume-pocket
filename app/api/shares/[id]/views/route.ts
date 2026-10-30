import { resolveOwner } from "../../../../lib/owner";
import { isResumeId } from "../../../../lib/resumes";
import { getOwnedLink, listShareViews } from "../../../../lib/shares";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** 所有者查看某条链接的访问明细 */
export async function GET(request: Request, { params }: Context) {
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;
  try {
    const link = isResumeId(id) ? await getOwnedLink(owner, id) : null;
    if (!link) return Response.json({ error: "未找到这条链接" }, { status: 404 });
    return Response.json(await listShareViews(link.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not list share views", error);
    return Response.json({ error: "暂时无法读取访问记录，请稍后重试" }, { status: 500 });
  }
}
