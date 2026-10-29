import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanShareInput, decryptShareToken, encryptShareToken, hashShareToken, isShareToken, maxLinks, newShareToken, parseProfile, resolveExpiry, shareStatus,
} from "../app/lib/share-policy.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-30T00:00:00.000Z");
const secret = Buffer.alloc(32, 7).toString("base64");

test("share tokens are random, well-formed, and stored only as digest plus ciphertext", async () => {
  const token = newShareToken();
  assert.match(token, /^[0-9A-Za-z]{12}$/);
  assert.equal(isShareToken(token), true);
  assert.notEqual(token, newShareToken());
  assert.equal(isShareToken("demo"), false);
  assert.equal(isShareToken("../" + token.slice(3)), false);
  assert.match(await hashShareToken(token), /^[0-9a-f]{64}$/);
  assert.equal(await hashShareToken(token), await hashShareToken(token));

  const sealed = await encryptShareToken(secret, token);
  assert.equal(sealed.includes(token), false);
  assert.equal(await decryptShareToken(secret, sealed), token);
  assert.equal(await decryptShareToken(Buffer.alloc(32, 8).toString("base64"), sealed), null);
  assert.equal(await decryptShareToken(secret, "broken"), null);
});

test("guests may only pick 1, 2 or 7 days, capped at the resume delete time", () => {
  assert.equal(resolveExpiry({ days: 1 }, "guest", now).getTime(), now.getTime() + DAY);
  assert.equal(typeof resolveExpiry({ days: 3 }, "guest", now), "string");
  assert.equal(typeof resolveExpiry({ permanent: true }, "guest", now), "string");
  assert.equal(typeof resolveExpiry({ until: "2026-11-02T00:00:00Z" }, "guest", now), "string");
  const deleteAt = new Date(now.getTime() + 2 * DAY);
  assert.equal(resolveExpiry({ days: 7 }, "guest", now, deleteAt).getTime(), deleteAt.getTime());
  assert.equal(maxLinks("guest"), 3);
});

test("registered users also get custom dates up to 365 days and permanent links", () => {
  assert.equal(resolveExpiry({ permanent: true }, "user", now), null);
  assert.equal(resolveExpiry({ until: "2026-12-01T00:00:00.000Z" }, "user", now).toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(typeof resolveExpiry({ until: "2026-10-29T00:00:00Z" }, "user", now), "string");
  assert.equal(typeof resolveExpiry({ until: new Date(now.getTime() + 366 * DAY).toISOString() }, "user", now), "string");
  assert.equal(typeof resolveExpiry({ until: "not a date" }, "user", now), "string");
  assert.equal(typeof resolveExpiry(null, "user", now), "string");
});

test("inactive wins over expired; permanent links never expire", () => {
  const past = new Date(now.getTime() - 1);
  assert.equal(shareStatus({ active: true, expiresAt: null }, now), "active");
  assert.equal(shareStatus({ active: true, expiresAt: past }, now), "expired");
  assert.equal(shareStatus({ active: true, expiresAt: now }, now), "expired");
  assert.equal(shareStatus({ active: false, expiresAt: past }, now), "inactive");
});

test("share text is plain, trimmed and length-limited; empty profile fields are dropped", () => {
  const input = cleanShareInput({ target: "  公司\u0007A ", note: "第一行\n第二行\u0000", profile: { name: " 林晓 ", role: "", email: 3, extra: "x" } });
  assert.equal(input.target, "公司A");
  assert.equal(input.note, "第一行\n第二行");
  assert.deepEqual(input.profile, { name: "林晓" });
  assert.equal(cleanShareInput({}).target, "未命名对象");
  assert.equal(cleanShareInput({ note: "字".repeat(600) }).note.length, 500);
  assert.deepEqual(parseProfile("not json"), {});
});
