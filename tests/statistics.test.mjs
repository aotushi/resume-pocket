import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readStatistics } from "../app/lib/statistics.ts";

test("statistics count real files and links, isolate owners, and return only site aggregates to admins", async (t) => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-10-29", r2Buckets: ["FILES"], d1Databases: ["DB"], cf: false }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  const bucket = await mf.getR2Bucket("FILES");
  for (const file of ["0000_heavy_morph.sql", "0001_share_links.sql", "0002_share_views.sql"]) {
    const statements = readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8").split("--> statement-breakpoint").map((sql) => sql.trim()).filter(Boolean);
    await db.batch(statements.map((sql) => db.prepare(sql)));
  }
  const now = new Date("2026-11-04T01:00:00.000Z");
  const a = "resumes/owner-a/", b = "resumes/owner-b/", guest = "guests/owner-c/";
  const ids = Array.from({ length: 4 }, () => crypto.randomUUID());
  for (const [prefix, id, createdAt] of [[a, ids[0], now.toISOString()], [b, ids[1], now.toISOString()], [guest, ids[2], "2026-10-01T00:00:00.000Z"]]) {
    await bucket.put(`${prefix}${id}.pdf`, "%PDF", { customMetadata: { name: encodeURIComponent(`${prefix}private.docx`), createdAt } });
    await bucket.put(`${prefix}${id}/${crypto.randomUUID()}.docx`, "old original");
  }
  for (const [id, verified] of [["a", 1], ["b", 1], ["unverified", 0]]) await db.prepare("INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,?,?,?)").bind(id, "Private name", `${id}@example.invalid`, verified, now.getTime(), now.getTime()).run();
  const definitions = [
    [a, ids[0], 1, null, 5],
    [a, ids[0], 0, now.getTime() - 1, 3],
    [a, ids[0], 1, now.getTime() - 1, 2],
    [b, ids[1], 1, null, 9],
    [guest, ids[2], 1, null, 4],
    [a, ids[3], 1, null, 1],
  ];
  const linkIds = [];
  for (const [prefix, resumeId, active, expiresAt, views] of definitions) {
    const id = crypto.randomUUID(); linkIds.push(id);
    await db.prepare("INSERT INTO share_link (id,ownerPrefix,resumeId,tokenHash,tokenEnc,target,note,profile,active,expiresAt,views,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, prefix, resumeId, id, "secret-token", "Private company", "private note", '{"email":"private@example.invalid"}', active, expiresAt, views, now.getTime()).run();
  }
  // Two different UTC days in the SAME Beijing day; future rows must be excluded.
  for (const [linkId, timestamp] of [[linkIds[0], "2026-11-03T17:00:00.000Z"], [linkIds[0], "2026-11-04T00:00:00.000Z"], [linkIds[3], "2026-11-04T00:00:00.000Z"], [linkIds[0], "2026-11-05T00:00:00.000Z"]]) {
    await db.prepare("INSERT INTO share_view (id,linkId,viewedAt,visitor) VALUES (?,?,?,?)").bind(crypto.randomUUID(), linkId, new Date(timestamp).getTime(), crypto.randomUUID()).run();
  }
  const own = await readStatistics(db, bucket, { ownerPrefix: a }, now);
  assert.equal(own.resumes, 1);
  assert.deepEqual(own.shares, { total: 4, active: 1, inactive: 1, expired: 1, missing: 1 });
  assert.equal(own.views, 11);
  assert.equal(own.recentViews, 2);
  assert.deepEqual(own.trend.at(-1), { day: "2026-11-04", views: 2 });
  assert.equal(own.trend.length, 7);
  assert.equal(own.resumeRows.length, 1);
  assert.equal(own.resumeRows[0].id, ids[0]);
  assert.equal(own.users, undefined);
  assert.equal(JSON.stringify(own).includes("owner-b"), false);

  const site = await readStatistics(db, bucket, { admin: true }, now);
  assert.equal(site.resumes, 2, "expired guests and versioned originals are not current resumes");
  assert.deepEqual(site.shares, { total: 6, active: 2, inactive: 1, expired: 1, missing: 2 });
  assert.equal(site.views, 24);
  assert.equal(site.recentViews, 3);
  assert.deepEqual(site.users, { total: 2, new7d: 2 });
  assert.equal(site.resumeRows, undefined);
  for (const secret of ["Private", "private", "owner-a", "secret-token", ids[0], "example.invalid"]) assert.equal(JSON.stringify(site).includes(secret), false);
  const empty = await readStatistics(db, bucket, { ownerPrefix: "resumes/empty/" }, now);
  assert.equal(empty.resumes, 0); assert.equal(empty.views, 0); assert.equal(empty.recentViews, 0); assert.equal(empty.shares.total, 0);
  assert.ok(empty.trend.every((day) => day.views === 0));
});
