import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";

type Options = {
  database: BetterAuthOptions["database"];
  secret: string;
  baseURL: string;
  sendCode: (data: { email: string; otp: string; type: string }) => Promise<void>;
  revokeUnverifiedAccess: (userId: string) => Promise<void>;
  deleteUserData?: (user: { id: string; email: string }) => Promise<void>;
};

// Recovery must work even when a browser still carries an old, unverified session.
const PUBLIC_AUTH_PATHS = new Set([
  "/sign-in/email", "/sign-up/email", "/sign-in/email-otp", "/sign-out",
  "/email-otp/send-verification-otp", "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password", "/email-otp/verify-email", "/verify-email",
]);

export function authOptions(options: Options) {
  return {
    database: options.database,
    secret: options.secret,
    baseURL: options.baseURL,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    // Revoked legacy sessions must stop working immediately, including on auth APIs.
    session: { cookieCache: { enabled: false }, freshAge: 5 * 60 },
    user: { deleteUser: { enabled: Boolean(options.deleteUserData), beforeDelete: options.deleteUserData } },
    rateLimit: { enabled: false },
    emailVerification: {
      beforeEmailVerification: async (user) => {
        if (!user.emailVerified) await options.revokeUnverifiedAccess(user.id);
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (PUBLIC_AUTH_PATHS.has(ctx.path)) return;
        const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
        if (session && !session.user.emailVerified) {
          if (ctx.path === "/get-session") return ctx.json(null);
          throw new APIError("FORBIDDEN", { code: "EMAIL_NOT_VERIFIED", message: "请先使用邮箱验证码登录" });
        }
      }),
    },
    plugins: [emailOTP({
      otpLength: 6, expiresIn: 600, allowedAttempts: 5, storeOTP: "hashed",
      sendVerificationOTP: options.sendCode,
    })],
  } satisfies BetterAuthOptions;
}

export function hasAdminAccess(user: { email: string; emailVerified: boolean } | null, allowlist: string) {
  if (!user?.emailVerified) return false;
  return allowlist.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean).includes(user.email.toLowerCase());
}
