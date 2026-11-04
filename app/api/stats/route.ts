import { env } from "cloudflare:workers";
import { resolveOwner } from "../../lib/owner";
import { readStatistics } from "../../lib/statistics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const owner = await resolveOwner(request);
  if (!owner) return Response.json({ error: "请先登录" }, { status: 401 });
  try {
    return Response.json(await readStatistics(env.DB, env.BUCKET, { ownerPrefix: owner.prefix }), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Could not read owner statistics", error);
    return Response.json({ error: "暂时无法读取统计，请稍后重试" }, { status: 503 });
  }
}
