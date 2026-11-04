import { isResumeId, ownerPrefix } from "./resume-policy.ts";
import { isGuestExpired } from "./guest-policy.ts";
import { deleteResumeFiles } from "./resume-storage.ts";

/** Called only by Better Auth after an authenticated, fresh account-deletion request. */
export async function deleteUserData(db: D1Database, bucket: R2Bucket, user: { id: string; email: string }) {
  const prefix = await ownerPrefix(user.id);
  // Keep a content-free marker so an upload already in progress cannot recreate deleted files.
  await bucket.put(`${prefix}.deleted`, "");
  await db.prepare("DELETE FROM share_link WHERE ownerPrefix = ?").bind(prefix).run();
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    const keys = page.objects.map((object) => object.key).filter((key) => key !== `${prefix}.deleted`);
    if (keys.length) await bucket.delete(keys);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  await db.prepare("DELETE FROM verification WHERE identifier IN (?, ?, ?)").bind(
    `sign-in-otp-${user.email.toLowerCase()}`, `email-verification-otp-${user.email.toLowerCase()}`, `forget-password-otp-${user.email.toLowerCase()}`,
  ).run();
  // Better Auth now deletes the user and cascades their credentials and sessions.
  // If any step above failed, it leaves the account intact so the user can retry.
}

/** An expired link alone is not enough: retain guest analytics until the document's 14-day retention ends. */
export async function cleanupExpiredGuests(db: D1Database, bucket: R2Bucket, now = new Date()) {
  let files = 0;
  let records = 0;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: "guests/", cursor, include: ["customMetadata"] });
    for (const object of page.objects) {
      const match = /^(guests\/[a-f0-9]{64}\/)([^/]+)\.pdf$/.exec(object.key);
      if (!match || !isResumeId(match[2])) continue;
      const created = new Date(object.customMetadata?.createdAt ?? object.uploaded.toISOString());
      if (!isGuestExpired(Number.isNaN(created.getTime()) ? object.uploaded : created, now)) continue;
      await deleteResumeFiles(bucket, match[1], match[2]);
      const result = await db.prepare("DELETE FROM share_link WHERE ownerPrefix = ? AND resumeId = ?").bind(match[1], match[2]).run();
      files++; records += result.meta.changes;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  // R2 lifecycle deletion can happen before this job. Remove those orphaned share/view rows too.
  let afterPrefix = "", afterId = "";
  for (;;) {
    const page = await db.prepare(`SELECT DISTINCT ownerPrefix, resumeId FROM share_link
      WHERE ownerPrefix LIKE 'guests/%' AND (ownerPrefix > ? OR (ownerPrefix = ? AND resumeId > ?))
      ORDER BY ownerPrefix, resumeId LIMIT 100`).bind(afterPrefix, afterPrefix, afterId)
      .all<{ ownerPrefix: string; resumeId: string }>();
    if (!page.results.length) break;
    for (const row of page.results) {
      afterPrefix = row.ownerPrefix; afterId = row.resumeId;
      if (!/^guests\/[a-f0-9]{64}\/$/.test(row.ownerPrefix) || !isResumeId(row.resumeId)) continue;
      if (await bucket.head(`${row.ownerPrefix}${row.resumeId}.pdf`)) continue;
      const result = await db.prepare("DELETE FROM share_link WHERE ownerPrefix = ? AND resumeId = ?").bind(row.ownerPrefix, row.resumeId).run();
      records += result.meta.changes;
    }
  }
  return { files, records };
}
