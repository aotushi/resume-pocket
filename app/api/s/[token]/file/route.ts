import { resumeFileResponse } from "../../../../lib/resumes";
import { resolveShare } from "../../../../lib/shares";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

/** 接收方读取简历文件：每次请求都重新检查链接，停用或到期后立即拒绝；参数同 /api/resumes/[id] */
export async function GET(request: Request, { params }: Context) {
  try {
    const share = await resolveShare((await params).token);
    if (share.state !== "active") {
      return Response.json({ error: "链接不存在或已失效" }, { status: share.state === "inactive" ? 410 : 404, headers: { "Cache-Control": "no-store" } });
    }
    const response = await resumeFileResponse(share.link.ownerPrefix, share.resume, new URL(request.url).searchParams.get("download"));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    console.error("Could not read shared resume", error);
    return Response.json({ error: "暂时无法打开简历，请稍后重试" }, { status: 503 });
  }
}
