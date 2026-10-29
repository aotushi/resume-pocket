import handler from "vinext/server/fetch-handler";

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
