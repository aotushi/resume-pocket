/**
 * 游客空间规则（docs/requirements.md 6.3 节）：不依赖 Cloudflare 运行时，便于单测。
 * 游客凭证是 64 位十六进制随机串，只存在浏览器 Cookie 与管理链接里；服务端只用它的摘要作存储前缀。
 */
export const GUEST_COOKIE = "rp_guest";
// 不含凭证、页面脚本可读的标记：/try 据此当场判断有没有游客空间，没有就直接显示上传界面
export const GUEST_HINT_COOKIE = "rp_guest_hint";
export const GUEST_MAX_RESUMES = 1;
export const GUEST_RETENTION_DAYS = 14;
export const GUEST_MAX_LINKS = 3;
export const GUEST_LINK_DAYS = [1, 2, 7] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function newGuestKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isGuestKey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

// 与登录用户的 resumes/ 前缀分开，便于用 R2 生命周期规则整体清理
export async function guestPrefix(key: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`guest:${key}`));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `guests/${hash}/`;
}

export function readGuestKey(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === GUEST_COOKIE) {
      const value = rest.join("=");
      return isGuestKey(value) ? value : null;
    }
  }
  return null;
}

const GUEST_COOKIE_MAX_AGE = GUEST_RETENTION_DAYS * 24 * 60 * 60;
const secureFlag = (request: Request) => new URL(request.url).protocol === "https:" ? "; Secure" : "";

export function guestHintCookie(request: Request) {
  return `${GUEST_HINT_COOKIE}=1; Path=/; Max-Age=${GUEST_COOKIE_MAX_AGE}; SameSite=Lax${secureFlag(request)}`;
}

/** 写入游客凭证与标记，返回多条 Set-Cookie */
export function guestCookies(key: string, request: Request) {
  return [`${GUEST_COOKIE}=${key}; Path=/; Max-Age=${GUEST_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secureFlag(request)}`, guestHintCookie(request)];
}

export const clearGuestCookies = () => [
  `${GUEST_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  `${GUEST_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
];

/** 多条 Set-Cookie 不能放进普通对象，只能逐条 append */
export function withCookies(cookies: string[], init?: HeadersInit) {
  const headers = new Headers(init);
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return headers;
}

export function guestDeleteAt(uploadedAt: Date) {
  return new Date(uploadedAt.getTime() + GUEST_RETENTION_DAYS * DAY_MS);
}

// 生命周期规则按天执行、可能滞后，所以读取时也按上传时间判断是否已过保留期
export function isGuestExpired(uploadedAt: Date, now = new Date()) {
  return now.getTime() >= guestDeleteAt(uploadedAt).getTime();
}
