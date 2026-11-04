import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { cleanupExpiredGuests, deleteUserData } from "../app/lib/data-cleanup.ts";
import { ownerPrefix } from "../app/lib/resume-policy.ts";

async function fixture(t) {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-10-29", r2Buckets: ["FILES"], d1Databases: ["DB"], cf: false }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB"), bucket = await mf.getR2Bucket("FILES");
  for (const file of ["0000_heavy_morph.sql", "0001_share_links.sql", "0002_share_views.sql"]) {
    const sql = readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8").split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
    await db.batch(sql.map((value) => db.prepare(value)));
  }
  async function document(prefix, createdAt, exists = true) {
    const id = crypto.randomUUID(), link = crypto.randomUUID();
    if (exists) {
      await bucket.put(`${prefix}${id}.pdf`, "%PDF", { customMetadata: { createdAt } });
      await bucket.put(`${prefix}${id}/${crypto.randomUUID()}.docx`, "historical original");
      await bucket.put(`${prefix}${id}.doc`, "legacy original");
    }
    await db.prepare("INSERT INTO share_link (id,ownerPrefix,resumeId,tokenHash,tokenEnc,target,note,profile,active,expiresAt,views,createdAt) VALUES (?,?,?,?,?,'','','{}',1,?,1,?)")
      .bind(link, prefix, id, link, "synthetic", new Date(createdAt).getTime() + 86_400_000, new Date(createdAt).getTime()).run();
    await db.prepare("INSERT INTO share_view (id,linkId,viewedAt,visitor) VALUES (?,?,?,?)").bind(crypto.randomUUID(), link, new Date(createdAt).getTime(), "synthetic").run();
    return { id, link, prefix };
  }
  return { db, bucket, document };
}

test("guest cleanup deletes only expired or orphaned guests and cascades their visit records", async (t) => {
  const { db, bucket, document } = await fixture(t);
  const now = new Date("2026-11-04T00:00:00Z");
  const expired = await document(`guests/${"a".repeat(64)}/`, "2026-10-21T00:00:00Z");
  const recent = await document(`guests/${"b".repeat(64)}/`, "2026-10-30T00:00:00Z");
  const orphan = await document(`guests/${"c".repeat(64)}/`, "2026-10-01T00:00:00Z", false);
  const registered = await document(await ownerPrefix("keep-user"), "2026-01-01T00:00:00Z");
  // D1 changes includes two links and their two cascaded visit rows.
  assert.deepEqual(await cleanupExpiredGuests(db, bucket, now), { files: 1, records: 4 });
  for (const removed of [expired, orphan]) {
    assert.equal((await bucket.list({ prefix: `${removed.prefix}${removed.id}` })).objects.length, 0);
    assert.equal(await db.prepare("SELECT id FROM share_link WHERE id = ?").bind(removed.link).first(), null);
    assert.equal(await db.prepare("SELECT id FROM share_view WHERE linkId = ?").bind(removed.link).first(), null);
  }
  for (const kept of [recent, registered]) {
    assert.ok(await bucket.head(`${kept.prefix}${kept.id}.pdf`));
    assert.ok(await db.prepare("SELECT id FROM share_link WHERE id = ?").bind(kept.link).first());
    assert.ok(await db.prepare("SELECT id FROM share_view WHERE linkId = ?").bind(kept.link).first());
  }
  assert.deepEqual(await cleanupExpiredGuests(db, bucket, now), { files: 0, records: 0 });
});

test("account cleanup removes all owned versions, links, visits and OTPs without touching other accounts", async (t) => {
  const { db, bucket, document } = await fixture(t);
  const user = { id: "delete-user", email: "delete@example.invalid" };
  const prefix = await ownerPrefix(user.id);
  const removed = await document(prefix, "2026-11-01T00:00:00Z");
  const kept = await document(await ownerPrefix("keep-user"), "2026-11-01T00:00:00Z");
  for (const email of [user.email, "keep@example.invalid"]) for (const type of ["sign-in", "email-verification", "forget-password"]) {
    await db.prepare("INSERT INTO verification (id,identifier,value,expiresAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), `${type}-otp-${email}`, "hash", Date.now() + 600_000, Date.now(), Date.now()).run();
  }
  await deleteUserData(db, bucket, user);
  assert.deepEqual((await bucket.list({ prefix })).objects.map((object) => object.key), [`${prefix}.deleted`]);
  assert.equal(await (await bucket.get(`${prefix}.deleted`)).text(), "");
  assert.equal(await db.prepare("SELECT id FROM share_link WHERE id = ?").bind(removed.link).first(), null);
  assert.equal(await db.prepare("SELECT id FROM share_view WHERE linkId = ?").bind(removed.link).first(), null);
  const verifications = (await db.prepare("SELECT identifier FROM verification").all()).results;
  assert.equal(verifications.length, 3);
  assert.ok(verifications.every((row) => row.identifier.endsWith("keep@example.invalid")));
  assert.ok(await bucket.head(`${kept.prefix}${kept.id}.pdf`));
  assert.ok(await db.prepare("SELECT id FROM share_view WHERE linkId = ?").bind(kept.link).first());
  await deleteUserData(db, bucket, user); // Retrying partial or completed cleanup is safe.
  assert.ok(await db.prepare("SELECT id FROM share_link WHERE id = ?").bind(kept.link).first());
});
