import test from "node:test";
import assert from "node:assert/strict";
import { isResumeId, isSameOrigin, ownerPrefix, readBoundedPdf, safeFilename, MAX_RESUME_BYTES } from "../app/lib/resume-policy.ts";

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

test("PDF uploads reject other types, invalid contents, and oversized files", async () => {
  assert.equal(safeFilename("简历.PDF"), "简历.pdf");
  assert.equal(safeFilename("resume.docx"), null);
  const makeRequest = (body) => new Request("https://example.test", { method: "POST", body });
  assert.equal(new TextDecoder().decode(await readBoundedPdf(makeRequest("%PDF-1.7\nexample"))).startsWith("%PDF-"), true);
  await assert.rejects(readBoundedPdf(makeRequest("not a PDF")), /不是有效的 PDF/);
  await assert.rejects(readBoundedPdf(makeRequest(new Uint8Array(MAX_RESUME_BYTES + 1))), /10 MB/);
});
