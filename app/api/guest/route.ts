import { GUEST_COOKIE, guestCookie, guestPrefix, isGuestKey, readGuestKey } from "../../lib/guest-policy";
import { guestRateLimited } from "../../lib/owner";
import { isSameOrigin, listResumes } from "../../lib/resumes";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

/** 当前浏览器持有的游客凭证，用于拼出管理链接；凭证只回给持有者本人 */
export async function GET(request: Request) {
  return Response.json({ manageKey: readGuestKey(request) }, { headers: noStore });
}

/** 凭管理链接在当前浏览器恢复游客空间：凭证必须对应仍有简历的空间 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源不正确。" }, { status: 403 });
  if (await guestRateLimited(request)) return Response.json({ error: "操作过于频繁，请稍后再试。" }, { status: 429 });
  const body = await request.json().catch(() => null) as { key?: unknown } | null;
  const key = body?.key;
  const missing = Response.json({ error: "管理链接无效，或这份游客简历已被删除。" }, { status: 404 });
  if (!isGuestKey(key)) return missing;
  const resumes = await listResumes({ kind: "guest", prefix: await guestPrefix(key), key });
  if (resumes.length === 0) return missing;
  return Response.json({ ok: true }, { headers: { ...noStore, "Set-Cookie": guestCookie(key, request) } });
}

/** 让当前浏览器忘记游客空间（不删除文件，凭管理链接仍可恢复） */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源不正确。" }, { status: 403 });
  return new Response(null, { status: 204, headers: { "Set-Cookie": `${GUEST_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` } });
}
