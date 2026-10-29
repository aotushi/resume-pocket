import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { getDb } from "../../db";
import * as schema from "../../db/schema";

export function getAuth() {
  if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) {
    throw new Error("Authentication is not configured: BETTER_AUTH_SECRET and BETTER_AUTH_URL are required.");
  }
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "sqlite", schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
    // The Worker applies a Cloudflare rate limit to the sign-in and sign-up routes.
    rateLimit: { enabled: false },
  });
}

export async function getCurrentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

// 管理员由环境变量 ADMIN_EMAILS（逗号分隔）指定，只在服务端判断，用户无法自行取得
export function isAdmin(user: { email: string } | null) {
  if (!user) return false;
  const admins = (env.ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}
