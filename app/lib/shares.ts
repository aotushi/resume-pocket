import { env } from "cloudflare:workers";
import { and, count, countDistinct, desc, eq, gt, gte, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { shareLink, shareView } from "../../db/schema";
import { type Owner, resolveOwner } from "./owner";
import { getBucket, type Resume, resumeFromObject } from "./resumes";
import { describeAgent, isAutomatedAgent, REPEAT_WINDOW_MS, VIEW_DETAIL_LIMIT, visitorHash } from "./view-policy";
import { decryptShareToken, hashShareToken, isShareToken, parseProfile, type ShareProfile, type ShareStatus, shareStatus } from "./share-policy";

/**
 * 分享链接的存取：记录在 D1 的 share_link 表，文件仍在 R2。
 * 所有者只能看到和操作自己存储前缀下的链接；公开访问凭链接标识的摘要查找，每次都重新判断状态。
 */
export type ShareLinkRow = typeof shareLink.$inferSelect;

/** 返回给所有者的链接信息；url 为 null 表示无法解密原标识，只能新建 */
export type ShareLinkView = {
  id: string;
  target: string;
  note: string;
  profile: ShareProfile;
  createdAt: string;
  expiresAt: string | null;
  active: boolean;
  views: number;
  status: ShareStatus;
  url: string | null;
};

export function shareSecret() {
  if (!env.SHARE_TOKEN_KEY) throw new Error("SHARE_TOKEN_KEY is not configured");
  return env.SHARE_TOKEN_KEY;
}

const ownerKindOf = (prefix: string): Owner["kind"] => prefix.startsWith("guests/") ? "guest" : "user";

/** 读取所有者名下的一份简历；游客简历过了保留期视为不存在 */
export async function findResume(prefix: string, resumeId: string): Promise<Resume | null> {
  const object = await getBucket().head(`${prefix}${resumeId}.pdf`);
  return object ? resumeFromObject(object, ownerKindOf(prefix)) : null;
}

export async function toView(row: ShareLinkRow, origin: string, now = new Date()): Promise<ShareLinkView> {
  const token = await decryptShareToken(shareSecret(), row.tokenEnc);
  return {
    id: row.id,
    target: row.target,
    note: row.note,
    profile: parseProfile(row.profile),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    active: row.active,
    views: row.views,
    status: shareStatus(row, now),
    url: token ? `${origin}/s/${token}` : null,
  };
}

export async function listShareLinks(owner: Owner, resumeId: string) {
  return getDb().select().from(shareLink)
    .where(and(eq(shareLink.ownerPrefix, owner.prefix), eq(shareLink.resumeId, resumeId)))
    .orderBy(sql`${shareLink.createdAt} desc`);
}

/** 仍然有效（启用且未到期）的链接数，用于数量上限 */
export async function countUsableLinks(owner: Owner, resumeId: string, now = new Date()) {
  const [row] = await getDb().select({ value: count() }).from(shareLink).where(and(
    eq(shareLink.ownerPrefix, owner.prefix),
    eq(shareLink.resumeId, resumeId),
    eq(shareLink.active, true),
    or(isNull(shareLink.expiresAt), gt(shareLink.expiresAt, now)),
  ));
  return row?.value ?? 0;
}

export async function getOwnedLink(owner: Owner, id: string) {
  const [row] = await getDb().select().from(shareLink).where(and(eq(shareLink.id, id), eq(shareLink.ownerPrefix, owner.prefix)));
  return row ?? null;
}

export async function deleteLinksForResume(prefix: string, resumeId: string) {
  await getDb().delete(shareLink).where(and(eq(shareLink.ownerPrefix, prefix), eq(shareLink.resumeId, resumeId)));
}

export type PublicShare =
  | { state: "missing" }
  | { state: "inactive" }
  | { state: "active"; link: ShareLinkRow; resume: Resume };

/**
 * 接收方访问时的判断：标识无效、链接不存在、已过期或简历已删除，一律按「不存在或已失效」处理；
 * 手动停用单独区分，以便显示停用提示。
 */
export async function resolveShare(token: string): Promise<PublicShare> {
  if (!isShareToken(token)) return { state: "missing" };
  const [link] = await getDb().select().from(shareLink).where(eq(shareLink.tokenHash, await hashShareToken(token)));
  if (!link) return { state: "missing" };
  const resume = await findResume(link.ownerPrefix, link.resumeId);
  if (!resume) return { state: "missing" };
  const status = shareStatus(link);
  if (status === "inactive") return { state: "inactive" };
  if (status === "expired") return { state: "missing" };
  return { state: "active", link, resume };
}

/** 记录一次分享页访问；按 view-policy.ts 的规则不计入时返回 false */
export async function recordShareView(link: ShareLinkRow, request: Request, now = new Date()) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (isAutomatedAgent(userAgent)) return false;
  // 所有者自己打开（登录账号或游客 Cookie 与链接同属一个空间）不算
  if ((await resolveOwner(request))?.prefix === link.ownerPrefix) return false;

  const db = getDb();
  const visitor = await visitorHash(shareSecret(), link.id, request.headers.get("cf-connecting-ip") ?? "local", userAgent);
  const [recent] = await db.select({ id: shareView.id }).from(shareView).where(and(
    eq(shareView.linkId, link.id),
    eq(shareView.visitor, visitor),
    gte(shareView.viewedAt, new Date(now.getTime() - REPEAT_WINDOW_MS)),
  )).limit(1);
  if (recent) return false;

  const cf = (request as Request & { cf?: { country?: string; region?: string; city?: string } }).cf;
  const place = [cf?.region, cf?.city].filter((part, index, parts) => part && parts.indexOf(part) === index).join(" ");
  await db.batch([
    db.insert(shareView).values({ id: crypto.randomUUID(), linkId: link.id, viewedAt: now, visitor, country: cf?.country ?? "", place, ...describeAgent(userAgent) }),
    db.update(shareLink).set({ views: sql`${shareLink.views} + 1` }).where(eq(shareLink.id, link.id)),
  ]);
  return true;
}

export type ShareViewEntry = { viewedAt: string; country: string; place: string; device: string; browser: string };

/** 所有者查看一条链接的访问明细：最近若干条，以及估算的不同访客数 */
export async function listShareViews(linkId: string) {
  const db = getDb();
  const [rows, [totals]] = await Promise.all([
    db.select().from(shareView).where(eq(shareView.linkId, linkId)).orderBy(desc(shareView.viewedAt)).limit(VIEW_DETAIL_LIMIT),
    db.select({ views: count(), visitors: countDistinct(shareView.visitor) }).from(shareView).where(eq(shareView.linkId, linkId)),
  ]);
  const views: ShareViewEntry[] = rows.map((row) => ({ viewedAt: row.viewedAt.toISOString(), country: row.country, place: row.place, device: row.device, browser: row.browser }));
  return { views, recorded: totals?.views ?? 0, visitors: totals?.visitors ?? 0 };
}
