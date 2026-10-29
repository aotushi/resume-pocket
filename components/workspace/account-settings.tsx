"use client";

/** 账户设置：昵称、修改密码对接 better-auth 现有接口；删除账户尚未开放 */
import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { signOut } from "./app-header";
import { PageHeader } from "./page-header";

type Props = { user: { name: string; email: string; createdAt: string } };

async function post(path: string, body: unknown) {
  const response = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return response;
}

export function AccountSettings({ user }: Props) {
  return <div className="mx-auto max-w-3xl">
    <PageHeader title="账户设置" description="管理你的个人资料与登录安全。" />
    <div className="mt-8 grid gap-6">
      <ProfileCard user={user} />
      <PasswordCard />
      <Card>
        <CardHeader><CardTitle>登录状态</CardTitle><CardDescription>在当前设备上退出登录。</CardDescription></CardHeader>
        <CardFooter className="border-t"><Button variant="outline" onClick={() => void signOut()}><LogOut />退出登录</Button></CardFooter>
      </Card>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">删除账户</CardTitle>
          <CardDescription>删除账户会同时删除你的全部简历及分享链接，且无法恢复。在线删除功能暂未开放，如需删除请通过问题反馈联系我们。</CardDescription>
        </CardHeader>
        <CardFooter className="border-t"><Button variant="destructive" disabled>删除账户（暂未开放）</Button></CardFooter>
      </Card>
    </div>
  </div>;
}

function ProfileCard({ user }: Props) {
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const joined = new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(new Date(user.createdAt));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const response = await post("update-user", { name: value });
      if (!response.ok) throw new Error();
      toast.success("资料已保存。");
      window.location.reload();
    } catch { toast.error("保存失败，请稍后重试。"); setBusy(false); }
  }

  return <Card>
    <form onSubmit={submit} className="grid gap-6">
      <CardHeader><CardTitle>基本资料</CardTitle><CardDescription>昵称仅在你的工作区显示，不会出现在分享页。</CardDescription></CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">昵称</Label>
          <Input id="name" className="h-10" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input id="email" className="h-10" value={user.email} disabled />
          <p className="text-xs text-muted-foreground">注册于 {joined}，邮箱暂不支持修改。</p>
        </div>
      </CardContent>
      <CardFooter className="border-t"><Button type="submit" disabled={busy || name.trim() === user.name || !name.trim()}>{busy && <Spinner />}保存</Button></CardFooter>
    </form>
  </Card>;
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (next !== confirm) { setError("两次输入的新密码不一致。"); return; }
    setBusy(true); setError("");
    try {
      const response = await post("change-password", { currentPassword: current, newPassword: next, revokeOtherSessions: true });
      if (!response.ok) throw new Error(response.status === 400 || response.status === 401 ? "当前密码不正确，或新密码不符合要求。" : "修改失败，请稍后重试。");
      setCurrent(""); setNext(""); setConfirm("");
      toast.success("密码已更新，其他设备上的登录已退出。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "修改失败，请稍后重试。"); }
    finally { setBusy(false); }
  }

  return <Card>
    <form onSubmit={submit} className="grid gap-6">
      <CardHeader><CardTitle>修改密码</CardTitle><CardDescription>修改后，其他设备上的登录会自动退出。</CardDescription></CardHeader>
      <CardContent className="grid gap-5">
        <div className="space-y-2 sm:max-w-sm">
          <Label htmlFor="current-password">当前密码</Label>
          <Input id="current-password" className="h-10" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-password">新密码</Label>
            <Input id="new-password" className="h-10" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={next} onChange={(event) => setNext(event.target.value)} required placeholder="至少 10 个字符" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">确认新密码</Label>
            <Input id="confirm-password" className="h-10" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
          </div>
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </CardContent>
      <CardFooter className="border-t"><Button type="submit" disabled={busy}>{busy && <Spinner />}更新密码</Button></CardFooter>
    </form>
  </Card>;
}
