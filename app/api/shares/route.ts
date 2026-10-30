import { getDb } from "../../../db";
import { shareLink } from "../../../db/schema";
import { guestRateLimited, resolveOwner } from "../../lib/owner";
import { isResumeId, isSameOrigin } from "../../lib/resumes";
import { cleanShareInput, encryptShareToken, hashShareToken, maxLinks, newShareToken, resolveExpiry } from "../../lib/share-policy";
import { countUsableLinks, findResume, listShareLinks, shareSecret, toView } from "../../lib/shares";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

/** 列出某份简历的全部分享链接（含已过期、已停用），供所有者管理 */
export async function GET(request: Request) {
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录" }, { status: 401 });
  const resumeId = new URL(request.url).searchParams.get("resume") ?? "";
  if (!isResumeId(resumeId)) return Response.json({ error: "未找到这份简历" }, { status: 404 });
  try {
    const origin = new URL(request.url).origin;
    const rows = await listShareLinks(owner, resumeId);
    const links = await Promise.all(rows.map((row) => toView(row, origin)));
    return Response.json({ links }, { headers: noStore });
  } catch (error) {
    console.error("Could not list share links", error);
    return Response.json({ error: "暂时无法读取分享链接，请稍后重试" }, { status: 500 });
  }
}

/** 为一份简历创建分享链接：校验所有权、数量上限与有效期，游客另受频率限制 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源不正确" }, { status: 403 });
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录" }, { status: 401 });
  if (owner.kind === "guest" && await guestRateLimited(request)) return Response.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });

  const body = await request.json().catch(() => null) as { resumeId?: unknown; expiry?: unknown } | null;
  const resumeId = typeof body?.resumeId === "string" ? body.resumeId : "";
  if (!isResumeId(resumeId)) return Response.json({ error: "未找到这份简历" }, { status: 404 });

  try {
    const resume = await findResume(owner.prefix, resumeId);
    if (!resume) return Response.json({ error: "未找到这份简历" }, { status: 404 });
    const now = new Date();
    const expiresAt = resolveExpiry(body?.expiry, owner.kind, now, resume.deleteAt ? new Date(resume.deleteAt) : undefined);
    if (typeof expiresAt === "string") return Response.json({ error: expiresAt }, { status: 400 });
    const limit = maxLinks(owner.kind);
    if (await countUsableLinks(owner, resumeId, now) >= limit) {
      const hint = owner.kind === "guest" ? "注册后可保留更多链接" : "请先停用或删除不再需要的链接";
      return Response.json({ error: `最多同时保留 ${limit} 条有效链接，${hint}` }, { status: 409 });
    }

    const { target, note, profile } = cleanShareInput(body);
    const token = newShareToken();
    const [row] = await getDb().insert(shareLink).values({
      id: crypto.randomUUID(),
      ownerPrefix: owner.prefix,
      resumeId,
      tokenHash: await hashShareToken(token),
      tokenEnc: await encryptShareToken(shareSecret(), token),
      target,
      note,
      profile: JSON.stringify(profile),
      expiresAt,
      active: true,
      views: 0,
      createdAt: now,
    }).returning();
    return Response.json({ link: await toView(row, new URL(request.url).origin, now) }, { status: 201, headers: noStore });
  } catch (error) {
    console.error("Could not create share link", error);
    return Response.json({ error: "创建失败，请稍后重试" }, { status: 500 });
  }
}
