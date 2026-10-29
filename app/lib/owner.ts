import { env } from "cloudflare:workers";
import { getCurrentUser } from "./auth";
import { guestPrefix, readGuestKey } from "./guest-policy";
import { ownerPrefix } from "./resume-policy";

/** 当前请求的简历所有者：已登录用户优先，否则看游客 Cookie；两者都没有时为 null */
export type Owner = { kind: "user"; prefix: string } | { kind: "guest"; prefix: string; key: string };

export async function resolveOwner(request: Request): Promise<Owner | null> {
  const user = await getCurrentUser();
  if (user) return { kind: "user", prefix: await ownerPrefix(user.id) };
  const key = readGuestKey(request);
  if (key) return { kind: "guest", prefix: await guestPrefix(key), key };
  return null;
}

/** 游客写操作按来源 IP 限流；本地 dev 没有该绑定时放行 */
export async function guestRateLimited(request: Request) {
  if (!env.GUEST_LIMITER) return false;
  const result = await env.GUEST_LIMITER.limit({ key: request.headers.get("cf-connecting-ip") ?? "local" });
  return !result.success;
}
