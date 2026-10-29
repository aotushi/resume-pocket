import { resolveShare } from "../../../lib/shares";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };

// 已打开的分享页定期查询链接状态；只回状态，不含任何简历或所有者信息
export async function GET(_request: Request, { params }: Context) {
  try {
    const share = await resolveShare((await params).token);
    return Response.json({ state: share.state }, { headers });
  } catch (error) {
    console.error("Could not check share link", error);
    return Response.json({ error: "暂时无法检查链接状态。" }, { status: 503, headers });
  }
}
