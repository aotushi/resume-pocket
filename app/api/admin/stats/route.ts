import { env } from "cloudflare:workers";
import { getCurrentUser, isAdmin } from "../../../lib/auth";
import { readStatistics } from "../../../lib/statistics";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdmin(await getCurrentUser())) return Response.json({ error: "未找到该页面" }, { status: 404 });
  try {
    return Response.json(await readStatistics(env.DB, env.BUCKET, { admin: true }), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Could not read site statistics", error);
    return Response.json({ error: "暂时无法读取统计，请稍后重试" }, { status: 503 });
  }
}
