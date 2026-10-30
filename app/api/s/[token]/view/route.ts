import { isSameOrigin } from "../../../../lib/resumes";
import { recordShareView, resolveShare } from "../../../../lib/shares";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

/** 分享页在浏览器中打开后上报一次访问；是否计入由 recordShareView 判断，结果不回给访问者 */
export async function POST(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  try {
    const share = await resolveShare((await params).token);
    if (share.state === "active") await recordShareView(share.link, request);
  } catch (error) {
    console.error("Could not record share view", error);
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
