import test from "node:test";
import assert from "node:assert/strict";
import { isResumeId, isSameOrigin, ownerPrefix, readBoundedFile, safeFilename, sourceTypeOf, MAX_RESUME_BYTES } from "../app/lib/resume-policy.ts";

test("different users have separate, stable storage prefixes", async () => {
  const one = await ownerPrefix("first/user");
  assert.equal(one, await ownerPrefix("first/user"));
  assert.notEqual(one, await ownerPrefix("second/user"));
  assert.match(one, /^resumes\/[a-f0-9]{64}\/$/);
  assert.equal(isResumeId("../other-user"), false);
  assert.equal(isResumeId(crypto.randomUUID()), true);
});

test("writes require the exact same origin", () => {
  const request = (origin) => new Request("https://example.test/api/resumes", { headers: origin ? { origin } : {} });
  assert.equal(isSameOrigin(request("https://example.test")), true);
  assert.equal(isSameOrigin(request("https://example.test.attacker.test")), false);
  assert.equal(isSameOrigin(request()), false);
});

test("uploads accept PDF and Word, and reject other types, invalid contents, and oversized files", async () => {
  assert.equal(safeFilename("简历.PDF"), "简历.pdf");
  assert.equal(safeFilename("简历.DOCX"), "简历.docx");
  assert.equal(safeFilename("旧简历.doc"), "旧简历.doc");
  assert.equal(safeFilename("resume.docm"), null);
  assert.equal(sourceTypeOf("a.doc"), "doc");
  const makeRequest = (body) => new Request("https://example.test", { method: "POST", body });
  assert.equal(new TextDecoder().decode(await readBoundedFile(makeRequest("%PDF-1.7\nexample"), "pdf")).startsWith("%PDF-"), true);
  await assert.rejects(readBoundedFile(makeRequest("not a PDF"), "pdf"), /不是有效的 PDF/);
  assert.equal((await readBoundedFile(makeRequest(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0])), "docx")).length, 5);
  await assert.rejects(readBoundedFile(makeRequest("%PDF-1.7"), "docx"), /不是有效的 Word/);
  await assert.rejects(readBoundedFile(makeRequest(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])), "doc"), /不是有效的 Word/);
  await assert.rejects(readBoundedFile(makeRequest(new Uint8Array(MAX_RESUME_BYTES + 1)), "pdf"), /10 MB/);
});
