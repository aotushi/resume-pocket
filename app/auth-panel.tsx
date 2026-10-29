"use client";

import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";

export function AuthPanel() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/auth/${mode === "signin" ? "sign-in" : "sign-up"}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, ...(mode === "signup" ? { name: email.trim().split("@")[0] } : {}) }),
      });
      if (!response.ok) {
        if (response.status === 429) throw new Error("请求过于频繁，请稍后再试。");
        if (mode === "signin") throw new Error("邮箱或密码不正确，请重试。");
        throw new Error("注册未成功，请检查邮箱和密码，或尝试登录已有账号。");
      }
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法连接，请稍后再试。");
    } finally { setBusy(false); }
  }

  return <form id="auth" className="signin-panel auth-panel" onSubmit={submit}>
    <div className="auth-heading"><div className="auth-icon"><LockKeyhole size={18} /></div><div><h3>{mode === "signin" ? "登录你的空间" : "创建你的空间"}</h3><p>{mode === "signin" ? "登录后，随时打开你的简历。" : "创建账号，跨设备保存你的简历。"}</p></div></div>
    <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" maxLength={254} /></label>
    <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="至少 10 个字符" /></label>
    {mode === "signup" && <p className="auth-hint">请妥善保管密码，目前暂不支持通过邮箱找回。</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button primary auth-submit" disabled={busy} type="submit">{busy ? "请稍等…" : mode === "signin" ? "登录" : "创建账号"}<ArrowRight size={16} /></button>
    <button className="auth-switch" type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>{mode === "signin" ? "还没有账号？创建一个" : "已有账号？返回登录"}</button>
  </form>;
}
