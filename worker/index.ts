import { Container } from "@cloudflare/containers";
import handler from "vinext/server/fetch-handler";

/** Word → PDF 转换容器（converter/），只接受 Worker 内部调用，且不允许访问外网 */
export class WordConverter extends Container {
  defaultPort = 8080;
  sleepAfter = "3m";
  enableInternet = false;
}

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && (pathname === "/api/auth/sign-in/email" || pathname === "/api/auth/sign-up/email")) {
      const key = request.headers.get("cf-connecting-ip") ?? "local";
      const result = await env.AUTH_LIMITER.limit({ key });
      if (!result.success) return Response.json({ message: "请求过于频繁，请稍后再试。" }, { status: 429 });
    }
    return handler.fetch(request, env, ctx);
  },
};
