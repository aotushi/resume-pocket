import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { headers } from "next/headers";
import { getDb } from "../../db";
import * as schema from "../../db/schema";

/** onSendError：验证码邮件发送失败时调用。better-auth 会吞掉发送异常并照常返回成功，由调用方据此改为报错 */
export function getAuth(onSendError?: () => void) {
  if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) {
    throw new Error("Authentication is not configured: BETTER_AUTH_SECRET and BETTER_AUTH_URL are required.");
  }
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "sqlite", schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
    // 会话签名缓存在 Cookie 里 5 分钟，期间读会话不查数据库；代价是其他设备退出登录最多晚 5 分钟生效
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    // The Worker applies a Cloudflare rate limit to the sign-in and sign-up routes.
    rateLimit: { enabled: false },
    // 验证码登录：新邮箱验证通过即自动注册；忘记密码也走验证码重置
    plugins: [emailOTP({ otpLength: 6, expiresIn: 600, allowedAttempts: 5, storeOTP: "hashed", sendVerificationOTP: async (data) => {
      try {
        await sendCodeEmail(data);
      } catch (error) {
        onSendError?.();
        throw error;
      }
    } })],
  });
}

const CODE_PURPOSE: Record<string, string> = { "sign-in": "登录", "forget-password": "重置密码", "email-verification": "验证邮箱" };

async function sendCodeEmail({ email, otp, type }: { email: string; otp: string; type: string }) {
  const purpose = CODE_PURPOSE[type] ?? "验证";
  if (!env.EMAIL_FROM) {
    // 本地开发不接真实邮件服务，验证码打印到终端；线上缺少发件地址则直接报错，避免验证码写进日志
    if (import.meta.env.DEV) { console.log(`[email-otp] ${email} ${purpose}验证码：${otp}`); return; }
    throw new Error("Email sending is not configured: EMAIL_FROM is required.");
  }
  await env.EMAIL.send({
    to: email,
    from: { email: env.EMAIL_FROM, name: "简历口袋" },
    subject: `${otp} 是你的简历口袋${purpose}验证码`,
    text: `你的${purpose}验证码是 ${otp}，10 分钟内有效。
如果不是你本人操作，请忽略这封邮件。`,
    html: `<div style="font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#18283c;line-height:1.6">
<p>你的${purpose}验证码是：</p>
<p style="font-size:28px;font-weight:600;letter-spacing:6px;margin:12px 0">${otp}</p>
<p>10 分钟内有效。如果不是你本人操作，请忽略这封邮件。</p>
<p style="color:#455468;font-size:13px">简历口袋</p></div>`,
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
