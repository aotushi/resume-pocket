import { isResumeId } from "./resume-policy.ts";
import { isGuestExpired } from "./guest-policy.ts";

export type ShareCounts = { total: number; active: number; inactive: number; expired: number; missing: number };
export type Statistics = {
  generatedAt: string;
  resumes: number;
  shares: ShareCounts;
  views: number;
  recentViews: number;
  trend: { day: string; views: number }[];
  users?: { total: number; new7d: number };
  resumeRows?: { id: string; name: string; shares: ShareCounts; views: number }[];
};
type Scope = { ownerPrefix: string } | { admin: true };
type Group = { ownerPrefix: string; resumeId: string; total: number; active: number; inactive: number; expired: number; views: number };
const emptyCounts = (): ShareCounts => ({ total: 0, active: 0, inactive: 0, expired: 0, missing: 0 });
const DAY = 86_400_000;
const CHINA_OFFSET = 8 * 3_600_000;
const dayKey = (milliseconds: number) => new Date(milliseconds + CHINA_OFFSET).toISOString().slice(0, 10);

/** Scope is selected by the server, never from query parameters. Only metadata is read from R2. */
export async function readStatistics(db: D1Database, bucket: R2Bucket, scope: Scope, now = new Date()): Promise<Statistics> {
  const owner = "ownerPrefix" in scope ? scope.ownerPrefix : null;
  const start = Math.floor((now.getTime() + CHINA_OFFSET) / DAY) * DAY - CHINA_OFFSET - 6 * DAY;
  const where = owner ? " WHERE ownerPrefix = ?" : "";
  const groupsQuery = db.prepare(`SELECT ownerPrefix, resumeId, COUNT(*) AS total,
    SUM(CASE WHEN active = 1 AND (expiresAt IS NULL OR expiresAt > ?) THEN 1 ELSE 0 END) AS active,
    SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) AS inactive,
    SUM(CASE WHEN active = 1 AND expiresAt <= ? THEN 1 ELSE 0 END) AS expired,
    SUM(views) AS views FROM share_link${where} GROUP BY ownerPrefix, resumeId`)
    .bind(now.getTime(), now.getTime(), ...(owner ? [owner] : []));
  const trendQuery = db.prepare(`SELECT strftime('%Y-%m-%d', v.viewedAt / 1000, 'unixepoch', '+8 hours') AS day, COUNT(*) AS views
    FROM share_view v INNER JOIN share_link l ON l.id = v.linkId
    WHERE v.viewedAt >= ? AND v.viewedAt <= ?${owner ? " AND l.ownerPrefix = ?" : ""} GROUP BY day`)
    .bind(start, now.getTime(), ...(owner ? [owner] : []));
  const usersQuery = owner ? Promise.resolve(null) : db.prepare(`SELECT COUNT(*) AS total,
    COALESCE(SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END), 0) AS new7d FROM user WHERE emailVerified = 1`)
    .bind(start).first<{ total: number; new7d: number }>();
  const [groups, trendRows, users, documents] = await Promise.all([
    groupsQuery.all<Group>(), trendQuery.all<{ day: string; views: number }>(), usersQuery,
    listDocuments(bucket, owner, now),
  ]);
  const byDocument = new Map(groups.results.map((group) => [`${group.ownerPrefix}${group.resumeId}`, group]));
  const existing = new Set(documents.map((document) => `${document.prefix}${document.id}`));
  const shares = emptyCounts();
  let views = 0;
  for (const group of groups.results) {
    shares.total += group.total;
    views += group.views;
    if (!existing.has(`${group.ownerPrefix}${group.resumeId}`)) shares.missing += group.total;
    else for (const status of ["active", "inactive", "expired"] as const) shares[status] += group[status];
  }
  const daily = new Map(trendRows.results.map((row) => [row.day, row.views]));
  const trend = Array.from({ length: 7 }, (_, index) => ({ day: dayKey(start + index * DAY), views: daily.get(dayKey(start + index * DAY)) ?? 0 }));
  return {
    generatedAt: now.toISOString(), resumes: documents.length, shares, views,
    recentViews: trend.reduce((sum, row) => sum + row.views, 0), trend,
    ...(users ? { users } : {}),
    ...(owner ? { resumeRows: documents.map((document) => {
      const group = byDocument.get(`${document.prefix}${document.id}`);
      return { id: document.id, name: document.name, views: group?.views ?? 0,
        shares: group ? { total: group.total, active: group.active, inactive: group.inactive, expired: group.expired, missing: 0 } : emptyCounts() };
    }) } : {}),
  };
}

async function listDocuments(bucket: R2Bucket, owner: string | null, now: Date) {
  const documents: { prefix: string; id: string; name: string }[] = [];
  for (const prefix of owner ? [owner] : ["resumes/", "guests/"]) {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix, cursor, include: ["customMetadata"] });
      for (const object of page.objects) {
        const match = /^(resumes|guests)\/[^/]+\/([^/]+)\.pdf$/.exec(object.key);
        if (!match || !isResumeId(match[2])) continue;
        const created = new Date(object.customMetadata?.createdAt ?? object.uploaded.toISOString());
        if (match[1] === "guests" && isGuestExpired(Number.isNaN(created.getTime()) ? object.uploaded : created, now)) continue;
        let name = "简历.pdf";
        if (owner) { try { name = decodeURIComponent(object.customMetadata?.name ?? "") || name; } catch { /* malformed metadata */ } }
        documents.push({ prefix: object.key.slice(0, object.key.lastIndexOf("/") + 1), id: match[2], name });
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  return documents;
}
