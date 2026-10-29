/**
 * 分享链接规则（docs/requirements.md 6.3、7 节）：不依赖 Cloudflare 运行时，便于单测，也供前端面板共用常量。
 * 链接标识是 12 位随机字母数字（约 71 位随机性，私密链接无法靠猜测命中）；服务端只用其摘要查找，另以 AES-GCM 加密保存原文供所有者再次复制。
 */
import { GUEST_LINK_DAYS, GUEST_MAX_LINKS } from "./guest-policy.ts";

export const LINK_DAYS = [1, 2, 7] as const;
export const USER_MAX_LINKS = 20;
export const USER_MAX_CUSTOM_DAYS = 365;
export const TARGET_MAX = 40;
export const NOTE_MAX = 500;

export const PROFILE_FIELDS = ["name", "role", "location", "email", "phone"] as const;
export type ShareProfile = Partial<Record<(typeof PROFILE_FIELDS)[number], string>>;
const PROFILE_MAX: Record<(typeof PROFILE_FIELDS)[number], number> = { name: 40, role: 60, location: 40, email: 100, phone: 30 };

/** 创建时的有效期选择：固定天数、自定义截止时间（仅注册用户）或永久（仅注册用户） */
export type ExpiryChoice = { days: number } | { until: string } | { permanent: true };
export type OwnerKind = "user" | "guest";
export type ShareStatus = "active" | "inactive" | "expired";

const DAY_MS = 24 * 60 * 60 * 1000;

export const maxLinks = (kind: OwnerKind) => kind === "guest" ? GUEST_MAX_LINKS : USER_MAX_LINKS;

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const TOKEN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const TOKEN_LENGTH = 12;

// 只用字母数字，聊天和邮件里不会被截断；拒绝采样（丢弃 ≥248 的字节）避免取模偏差
export function newShareToken() {
  let token = "";
  while (token.length < TOKEN_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH * 2))) {
      if (byte < 248 && token.length < TOKEN_LENGTH) token += TOKEN_ALPHABET[byte % 62];
    }
  }
  return token;
}

export function isShareToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-Za-z]{12}$/.test(value);
}

export async function hashShareToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`share:${token}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// 密钥为 base64 编码的 32 字节；丢失后旧链接仍可访问，只是所有者无法再复制，需要新建
async function importKey(secret: string) {
  const raw = Uint8Array.from(atob(secret), (char) => char.charCodeAt(0));
  if (raw.length !== 32) throw new Error("SHARE_TOKEN_KEY must be 32 bytes of base64");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptShareToken(secret: string, token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(secret), new TextEncoder().encode(token));
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(data))}`;
}

/** 解密失败（密钥更换、数据损坏）返回 null，由界面提示新建链接 */
export async function decryptShareToken(secret: string, value: string) {
  try {
    const [iv, data] = value.split(".");
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, await importKey(secret), fromBase64Url(data));
    const token = new TextDecoder().decode(plain);
    return isShareToken(token) ? token : null;
  } catch {
    return null;
  }
}

/**
 * 计算到期时间：游客只能选 1/2/7 天且不晚于简历删除时间；注册用户另有自定义（最长 365 天）与永久。
 * 返回 null 表示永久有效，返回字符串为错误提示。
 */
export function resolveExpiry(choice: unknown, kind: OwnerKind, now: Date, deleteAt?: Date): Date | null | string {
  const value = choice as Partial<{ days: unknown; until: unknown; permanent: unknown }> | null;
  let expiresAt: Date | null;
  if (value && typeof value.days === "number") {
    const allowed: readonly number[] = kind === "guest" ? GUEST_LINK_DAYS : LINK_DAYS;
    if (!allowed.includes(value.days)) return "请选择有效期。";
    expiresAt = new Date(now.getTime() + value.days * DAY_MS);
  } else if (value && value.permanent === true) {
    if (kind === "guest") return "游客链接最长 7 天，注册后可设为永久有效。";
    expiresAt = null;
  } else if (value && typeof value.until === "string") {
    if (kind === "guest") return "游客链接最长 7 天，注册后可自定义日期。";
    const until = new Date(value.until);
    if (Number.isNaN(until.getTime()) || until.getTime() <= now.getTime()) return "截止时间需晚于现在。";
    if (until.getTime() > now.getTime() + USER_MAX_CUSTOM_DAYS * DAY_MS) return `自定义有效期最长 ${USER_MAX_CUSTOM_DAYS} 天，更久请选永久有效。`;
    expiresAt = until;
  } else {
    return "请选择有效期。";
  }
  if (deleteAt && (expiresAt === null || expiresAt.getTime() > deleteAt.getTime())) expiresAt = deleteAt;
  return expiresAt;
}

// 停用优先：停用后又到期的链接仍按已停用展示（需求 7.3）
export function shareStatus(link: { active: boolean; expiresAt: Date | null }, now = new Date()): ShareStatus {
  if (!link.active) return "inactive";
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

// 所有文本按纯文本保存：去掉控制字符并截断，渲染时由 React 转义
function cleanText(value: unknown, max: number, multiline = false) {
  if (typeof value !== "string") return "";
  const pattern = multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g;
  return value.replace(pattern, "").trim().slice(0, max);
}

export function cleanShareInput(body: unknown) {
  const value = (body ?? {}) as Record<string, unknown>;
  const rawProfile = (value.profile ?? {}) as Record<string, unknown>;
  const profile: ShareProfile = {};
  for (const field of PROFILE_FIELDS) {
    const text = cleanText(rawProfile[field], PROFILE_MAX[field]);
    if (text) profile[field] = text;
  }
  return {
    target: cleanText(value.target, TARGET_MAX) || "未命名对象",
    note: cleanText(value.note, NOTE_MAX, true),
    profile,
  };
}

export function parseProfile(value: string): ShareProfile {
  try {
    return cleanShareInput({ profile: JSON.parse(value) }).profile;
  } catch {
    return {};
  }
}
