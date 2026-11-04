"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setSignedIn } from "@/components/site/signed-in";

export function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function post(path: string, body: unknown) {
    const response = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(response.status === 429 ? "操作过于频繁，请稍后再试" : "操作未完成，请重新获取验证码后重试。如已开始清理，部分数据可能已删除。");
  }
  async function send() {
    setBusy(true); setError("");
    try { await post("email-otp/send-verification-otp", { email, type: "sign-in" }); setSent(true); setCooldown(60); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "邮件发送失败，请稍后重试"); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    try {
      // A newly verified session is required before the destructive request.
      await post("sign-in/email-otp", { email, otp: code });
      await post("delete-user", {});
      setSignedIn(false);
      // Clear the authenticated page and all client route caches after account removal.
      window.location.replace(new URL("/", window.location.origin).href);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "注销未完成，请重试"); setBusy(false); }
  }

  return <AlertDialog open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); setCode(""); setError(""); } }}>
    <AlertDialogTrigger asChild><Button variant="destructive" className="min-h-11">删除账户</Button></AlertDialogTrigger>
    <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <AlertDialogHeader>
        <AlertDialogTitle>永久删除账户？</AlertDialogTitle>
        <AlertDialogDescription>这会删除账户、全部简历原件与历史版本、分享链接和访问记录，所有设备都会退出登录。此操作无法撤销。请先下载需要保留的文件，再验证邮箱。</AlertDialogDescription>
      </AlertDialogHeader>
      <div className="space-y-4">
        <p className="break-all text-sm">确认邮箱：{email}</p>
        <Button variant="outline" className="min-h-11" disabled={busy || cooldown > 0} onClick={() => void send()}>{cooldown > 0 ? `${cooldown} 秒后可重新发送` : "发送确认验证码"}</Button>
        {sent && <div className="space-y-2"><Label htmlFor="delete-account-code">邮箱验证码</Label><Input id="delete-account-code" className="h-11" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="6 位验证码" /><p className="text-xs text-muted-foreground">验证码 10 分钟内有效，未收到请检查垃圾邮件</p></div>}
        {error && <p className="text-sm leading-relaxed text-destructive" role="alert">{error}</p>}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel className="min-h-11" disabled={busy}>保留账户</AlertDialogCancel>
        <AlertDialogAction variant="destructive" className="min-h-11" disabled={busy || !sent || code.length !== 6} onClick={(event) => { event.preventDefault(); void remove(); }}>{busy ? "处理中…" : "确认永久删除"}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
