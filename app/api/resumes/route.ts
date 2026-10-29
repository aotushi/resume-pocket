import { getCurrentUser } from "../../lib/auth";
import {
  getBucket,
  isSameOrigin,
  ownerPrefix,
  readBoundedPdf,
  resumeFromObject,
  safeFilename,
} from "../../lib/resumes";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });

  try {
    const bucket = getBucket();
    const prefix = await ownerPrefix(user.id);
    const resumes = [];
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix, cursor, include: ["customMetadata"] });
      resumes.push(...page.objects.map(resumeFromObject).filter((item) => item !== null));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    resumes.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return Response.json({ resumes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not list resumes", error);
    return Response.json({ error: "暂时无法读取简历，请稍后重试。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源不正确。" }, { status: 403 });

  let name: string | null = null;
  try {
    name = safeFilename(decodeURIComponent(request.headers.get("x-resume-name") ?? ""));
  } catch {
    // Return the same message as for an invalid name.
  }
  if (!name) return Response.json({ error: "请选择 PDF 格式的简历。" }, { status: 400 });

  let bytes: Uint8Array;
  try {
    bytes = await readBoundedPdf(request);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "文件读取失败。" }, { status: 400 });
  }

  try {
    const id = crypto.randomUUID();
    const bucket = getBucket();
    const prefix = await ownerPrefix(user.id);
    const object = await bucket.put(`${prefix}${id}.pdf`, bytes, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { name: encodeURIComponent(name) },
    });
    return Response.json({ resume: resumeFromObject(object) }, { status: 201 });
  } catch (error) {
    console.error("Could not save resume", error);
    return Response.json({ error: "保存失败，请稍后重试。" }, { status: 500 });
  }
}
