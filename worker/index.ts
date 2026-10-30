import { Container } from "@cloudflare/containers";
import handler from "vinext/server/fetch-handler";

/** Word → PDF 转换容器（converter/），只接受 Worker 内部调用，且不允许访问外网 */
export class WordConverter extends Container {
  defaultPort = 8080;
  sleepAfter = "3m";
  enableInternet = false;
}

/** 按 IP 限流的登录相关接口：密码登录/注册、验证码发送与校验、验证码重置密码 */
const AUTH_PATHS = new Set([
  "/api/auth/sign-in/email",
  "/api/auth/sign-up/email",
  "/api/auth/email-otp/send-verification-otp",
  "/api/auth/sign-in/email-otp",
  "/api/auth/email-otp/reset-password",
]);

const tooMany = () => Response.json({ message: "请求过于频繁，请稍后再试。" }, { status: 429 });

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && AUTH_PATHS.has(pathname)) {
      const key = request.headers.get("cf-connecting-ip") ?? "local";
      if (!(await env.AUTH_LIMITER.limit({ key })).success) return tooMany();
      // 发验证码另按收件邮箱限流，换 IP 也不能对同一邮箱刷信
      if (pathname === "/api/auth/email-otp/send-verification-otp") {
        const body = await request.clone().json().catch(() => null) as { email?: unknown } | null;
        const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
        if (email && !(await env.OTP_LIMITER.limit({ key: email })).success) return tooMany();
      }
    }
    return handler.fetch(request, env, ctx);
  },
};
