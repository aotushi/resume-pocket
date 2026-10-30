"use client";

/**
 * 首页、说明页的登录状态在浏览器里判断，页面本身不读 Cookie，才能整页缓存、提前加载。
 * 先用上次的结果（localStorage）避免已登录用户看到按钮闪一下，再向服务器确认一次。
 */
import { useSyncExternalStore } from "react";

const HINT_KEY = "rp-signed-in";
let signedIn: boolean | null = null;
let checking = false;
const listeners = new Set<() => void>();

function readHint() {
  try { return localStorage.getItem(HINT_KEY) === "1"; } catch { return false; }
}

export function setSignedIn(value: boolean) {
  signedIn = value;
  try { if (value) localStorage.setItem(HINT_KEY, "1"); else localStorage.removeItem(HINT_KEY); } catch { /* 隐私模式下忽略 */ }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (signedIn === null && !checking) {
    checking = true;
    // 会话 Cookie 缓存 5 分钟，这个请求通常不查数据库
    fetch("/api/auth/get-session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ user?: unknown } | null> : null)
      .then((data) => setSignedIn(Boolean(data?.user)))
      .catch(() => {})
      .finally(() => { checking = false; });
  }
  return () => { listeners.delete(listener); };
}

export function useSignedIn() {
  return useSyncExternalStore(subscribe, () => signedIn ?? readHint(), () => false);
}

/** 按登录状态二选一渲染；两个分支都可以是服务端组件 */
export function SignedInSwitch({ signedIn: whenIn, signedOut: whenOut = null }: { signedIn?: React.ReactNode; signedOut?: React.ReactNode }) {
  return <>{useSignedIn() ? whenIn : whenOut}</>;
}
