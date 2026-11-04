import test from "node:test";
import assert from "node:assert/strict";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { saveResumeFiles, originalObjectKey, deleteResumeFiles, ResumeConflictError } from "../app/lib/resume-storage.ts";

const prefix = "resumes/test-owner/";
const bytes = (value) => new TextEncoder().encode(value);
const upload = (type, version) => ({ name: `resume.${type}`, type, bytes: bytes(`original-${version}`), pdf: bytes(`%PDF-${version}`) });
const replacing = (object) => ({ etag: object.etag, createdAt: object.customMetadata.createdAt });

function interceptPut(bucket, handler) {
  return new Proxy(bucket, { get(target, key) { return key === "put" ? handler : typeof target[key] === "function" ? target[key].bind(target) : target[key]; } });
}

test("R2 publication keeps PDF and original consistent across failures, races, and legacy files", async (t) => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-10-29", r2Buckets: ["FILES"], cf: false }));
  t.after(() => mf.dispose());
  const bucket = await mf.getR2Bucket("FILES");
  async function pair(id) {
    const pdf = await bucket.get(`${prefix}${id}.pdf`);
    const original = await bucket.get(originalObjectKey(prefix, id, pdf.customMetadata.source, pdf.customMetadata));
    return [await pdf.text(), await original.text()];
  }

  for (const type of ["docx", "doc"]) await t.test(`${type}: failed original or PDF write retains the old complete revision`, async () => {
    const id = crypto.randomUUID();
    const old = await saveResumeFiles(bucket, prefix, id, upload(type, "old"));
    for (const stage of ["original", "pdf"]) {
      const failing = interceptPut(bucket, async (key, ...args) => {
        if ((stage === "pdf") === key.endsWith(".pdf")) throw new Error("injected storage failure");
        return bucket.put(key, ...args);
      });
      await assert.rejects(saveResumeFiles(failing, prefix, id, upload(type, "new"), replacing(old)), /injected/);
      assert.deepEqual(await pair(id), ["%PDF-old", "original-old"]);
    }
    const next = await saveResumeFiles(bucket, prefix, id, upload(type, "new"), replacing(old));
    assert.deepEqual(await pair(id), ["%PDF-new", "original-new"]);
    assert.equal(next.customMetadata.createdAt, old.customMetadata.createdAt);
    assert.notEqual(next.customMetadata.version, old.customMetadata.version);
    assert.equal(await (await bucket.get(originalObjectKey(prefix, id, type, old.customMetadata))).text(), "original-old", "an in-flight old reader remains valid");
  });

  await t.test("a response lost after commit never deletes the newly published original", async () => {
    const id = crypto.randomUUID();
    const old = await saveResumeFiles(bucket, prefix, id, upload("docx", "old"));
    const failing = interceptPut(bucket, async (key, ...args) => {
      const result = await bucket.put(key, ...args);
      if (key.endsWith(".pdf")) throw new Error("response lost after commit");
      return result;
    });
    await assert.rejects(saveResumeFiles(failing, prefix, id, upload("docx", "new"), replacing(old)));
    assert.deepEqual(await pair(id), ["%PDF-new", "original-new"]);
  });

  await t.test("same PDF bytes with a changed original still receive a new public version", async () => {
    const id = crypto.randomUUID();
    const old = await saveResumeFiles(bucket, prefix, id, upload("docx", "old"));
    const next = await saveResumeFiles(bucket, prefix, id, { ...upload("docx", "new"), pdf: bytes("%PDF-old") }, replacing(old));
    assert.equal(old.etag, next.etag);
    assert.notEqual(old.customMetadata.version, next.customMetadata.version);
    assert.deepEqual(await pair(id), ["%PDF-old", "original-new"]);
  });

  await t.test("legacy Word files survive failures and upgrade without changing their resume ID", async () => {
    const id = crypto.randomUUID();
    await bucket.put(`${prefix}${id}.docx`, bytes("legacy-original"));
    const old = await bucket.put(`${prefix}${id}.pdf`, bytes("%PDF-legacy"), { customMetadata: { source: "docx", createdAt: "2026-01-01T00:00:00.000Z" } });
    assert.deepEqual(await pair(id), ["%PDF-legacy", "legacy-original"]);
    const failing = interceptPut(bucket, async (key, ...args) => { if (key.endsWith(".pdf")) throw new Error("fail"); return bucket.put(key, ...args); });
    await assert.rejects(saveResumeFiles(failing, prefix, id, upload("docx", "new"), replacing(old)));
    assert.deepEqual(await pair(id), ["%PDF-legacy", "legacy-original"]);
    const next = await saveResumeFiles(bucket, prefix, id, upload("doc", "converted"), replacing(old));
    assert.deepEqual(await pair(id), ["%PDF-converted", "original-converted"]);
    await saveResumeFiles(bucket, prefix, id, upload("pdf", "plain"), replacing(next));
    assert.deepEqual(await pair(id), ["%PDF-plain", "%PDF-plain"]);
  });

  await t.test("a concurrent replacement or deletion cannot be overwritten by a stale upload", async () => {
    const id = crypto.randomUUID();
    const old = await saveResumeFiles(bucket, prefix, id, upload("docx", "old"));
    await saveResumeFiles(bucket, prefix, id, upload("docx", "winner"), replacing(old));
    await assert.rejects(saveResumeFiles(bucket, prefix, id, upload("docx", "stale"), replacing(old)), ResumeConflictError);
    assert.deepEqual(await pair(id), ["%PDF-winner", "original-winner"]);
    await deleteResumeFiles(bucket, prefix, id);
    await assert.rejects(saveResumeFiles(bucket, prefix, id, upload("docx", "stale"), replacing(old)), ResumeConflictError);
    assert.equal(await bucket.head(`${prefix}${id}.pdf`), null);
    await deleteResumeFiles(bucket, prefix, id);
    assert.equal((await bucket.list({ prefix: `${prefix}${id}` })).objects.length, 0);
  });
});
