import { FORMAT_ERROR, GUEST_FORMAT_ERROR } from "../../lib/format-copy";
import { GUEST_MAX_RESUMES, guestCookie, guestPrefix, newGuestKey } from "../../lib/guest-policy";
import { guestRateLimited, resolveOwner } from "../../lib/owner";
import { isSameOrigin, listResumes, readUpload, resumeFromObject, saveResume, uploadName } from "../../lib/resumes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录" }, { status: 401 });

  try {
    const resumes = await listResumes(owner);
    return Response.json({ resumes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Could not list resumes", error);
    return Response.json({ error: "暂时无法读取简历，请稍后重试" }, { status: 500 });
  }
}

/**
 * 已登录用户上传到自己的空间；未登录时作为游客上传，首次上传会创建游客空间并下发 Cookie。
 * Word 仅限注册用户：先转换成 PDF，转换成功才同时保存原件与 PDF，失败则什么都不保存。
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源不正确" }, { status: 403 });

  const named = uploadName(request);
  if (!named) return Response.json({ error: FORMAT_ERROR }, { status: 400 });
  const { type } = named;

  let owner = await resolveOwner(request);
  let newKey: string | null = null;
  if (owner?.kind !== "user") {
    if (type !== "pdf") return Response.json({ error: GUEST_FORMAT_ERROR }, { status: 400 });
    if (await guestRateLimited(request)) return Response.json({ error: "操作过于频繁，请稍后再试" }, { status: 429 });
    if (!owner) {
      newKey = newGuestKey();
      owner = { kind: "guest", prefix: await guestPrefix(newKey), key: newKey };
    } else if ((await listResumes(owner)).length >= GUEST_MAX_RESUMES) {
      return Response.json({ error: "游客空间只能保存 1 份简历，请先删除现有简历，或注册后保存多份" }, { status: 409 });
    }
  }

  const upload = await readUpload(request, type);
  if (upload instanceof Response) return upload;

  try {
    const object = await saveResume(owner.prefix, crypto.randomUUID(), { ...named, ...upload });
    const headers = newKey ? { "Set-Cookie": guestCookie(newKey, request) } : undefined;
    return Response.json({ resume: resumeFromObject(object, owner.kind) }, { status: 201, headers });
  } catch (error) {
    console.error("Could not save resume", error);
    return Response.json({ error: "保存失败，请稍后重试" }, { status: 500 });
  }
}
