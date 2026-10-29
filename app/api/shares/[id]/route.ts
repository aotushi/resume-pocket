import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { shareLink } from "../../../../db/schema";
import { resolveOwner } from "../../../lib/owner";
import { isResumeId, isSameOrigin } from "../../../lib/resumes";
import { maxLinks, shareStatus } from "../../../lib/share-policy";
import { countUsableLinks, getOwnedLink, toView } from "../../../lib/shares";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function ownedLink(request: Request, params: Context["params"]) {
  if (!isSameOrigin(request)) return { error: Response.json({ error: "请求来源不正确。" }, { status: 403 }) };
  const owner = await resolveOwner(request);
  if (!owner) return { error: Response.json({ error: "请先登录。" }, { status: 401 }) };
  const { id } = await params;
  const link = isResumeId(id) ? await getOwnedLink(owner, id) : null;
  if (!link) return { error: Response.json({ error: "未找到这条链接。" }, { status: 404 }) };
  return { owner, link };
}

/** 停用或重新启用：重新启用不改变原有效期，已过期的链接不能重新启用，也不能超出数量上限 */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const result = await ownedLink(request, params);
    if ("error" in result) return result.error;
    const { owner, link } = result;
    const body = await request.json().catch(() => null) as { active?: unknown } | null;
    if (typeof body?.active !== "boolean") return Response.json({ error: "请求内容不正确。" }, { status: 400 });

    const now = new Date();
    if (body.active && !link.active) {
      if (shareStatus({ active: true, expiresAt: link.expiresAt }, now) === "expired") {
        return Response.json({ error: "这条链接已过期，无法重新启用。请新建一条链接。" }, { status: 409 });
      }
      const limit = maxLinks(owner.kind);
      if (await countUsableLinks(owner, link.resumeId, now) >= limit) {
        return Response.json({ error: `最多同时保留 ${limit} 条有效链接，请先停用其他链接。` }, { status: 409 });
      }
    }
    const [row] = await getDb().update(shareLink).set({ active: body.active }).where(eq(shareLink.id, link.id)).returning();
    return Response.json({ link: await toView(row, new URL(request.url).origin, now) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not update share link", error);
    return Response.json({ error: "操作失败，请稍后重试。" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const result = await ownedLink(request, params);
    if ("error" in result) return result.error;
    await getDb().delete(shareLink).where(eq(shareLink.id, result.link.id));
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Could not delete share link", error);
    return Response.json({ error: "删除失败，请稍后重试。" }, { status: 500 });
  }
}
