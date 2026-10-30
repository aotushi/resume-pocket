"use client";

/**
 * 游客空间（/try）：复用「我的简历」工作区的上传/预览/删除，加上管理链接与分享面板。
 * 管理链接形如 /try#k=<凭证>：凭证放在 # 之后，不会随请求发到服务器或写进访问日志。
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import type { Resume } from "@/app/lib/resumes";
import { AuthButton } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { ResumeWorkspace } from "@/components/workspace/resume-workspace";
import { ShareLinksPanel } from "@/components/share/share-links-panel";

export function GuestSpace() {
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const resume = resumes[0] ?? null;

  // 通过管理链接进入：先在当前浏览器恢复凭证，再重新加载工作区
  useEffect(() => {
    const key = window.location.hash.match(/^#k=([0-9a-f]{64})$/)?.[1];
    if (!key) return;
    window.history.replaceState(null, "", window.location.pathname);
    fetch("/api/guest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) })
      .then(async (response) => {
        if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "管理链接无效");
        toast.success("已在这个浏览器恢复你的游客空间");
        setWorkspaceKey((value) => value + 1);
      })
      .catch((error: Error) => toast.error(error.message));
  }, []);

  return <div className="grid grid-cols-1 gap-8">
    <ResumeWorkspace key={workspaceKey} guest onResumesChange={setResumes} />
    {resume && <>
      <ManageLinkCard key={resume.id} />
      <ShareLinksPanel key={`share-${resume.id}`} resume={resume} guest />
    </>}
    <UpgradeCard />
  </div>;
}

function ManageLinkCard() {
  const [manageKey, setManageKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const base = `${window.location.origin}/try#k=`;
  const url = manageKey ? base + manageKey : "";

  useEffect(() => {
    let active = true;
    fetch("/api/guest", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ manageKey: string | null }>)
      .then((data) => { if (active) setManageKey(data.manageKey); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("管理链接已复制，请保存在只有你能看到的地方");
    setTimeout(() => setCopied(false), 2000);
  }, [url]);

  async function forget() {
    await fetch("/api/guest", { method: "DELETE" });
    window.location.reload();
  }

  if (!manageKey) return null;
  return <section aria-labelledby="manage-title" className="rounded-xl border border-warning/40 bg-warning/5 p-5 sm:p-6 print:hidden">
    <div className="flex items-start gap-3">
      <span className="hidden size-10 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning sm:grid"><KeyRound className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 id="manage-title" className="font-semibold">保存你的管理链接</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">游客没有账号，这个浏览器靠它记住你。换设备或清除浏览器数据后，只能用管理链接继续停用链接或删除简历。<strong className="font-medium text-foreground">它相当于密码，不要发给招聘方</strong>——发给对方的是下方的分享链接。</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <code className="min-w-0 flex-1 truncate rounded-md border bg-card px-3 py-2 text-xs leading-5">{visible ? url : base + "•".repeat(24)}</code>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setVisible((value) => !value)} aria-label={visible ? "隐藏管理链接" : "显示管理链接"}>{visible ? <EyeOff /> : <Eye />}</Button>
            <Button onClick={() => void copy()}>{copied ? <Check /> : <Copy />}复制管理链接</Button>
          </div>
        </div>
        <button type="button" onClick={() => void forget()} className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><LogOut className="size-3.5" />在这个浏览器退出游客空间（不删除简历）</button>
      </div>
    </div>
  </section>;
}

function UpgradeCard() {
  return <section aria-labelledby="upgrade-title" className="rounded-xl border bg-card p-5 sm:p-6 print:hidden">
    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 id="upgrade-title" className="font-semibold">需要长期使用？注册后可以：</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          {["保存多份简历，不会自动删除", "使用自定义日期或永久有效的链接", "查看完整的访问统计", "在任何设备登录后管理"].map((item) => <li key={item} className="flex items-center gap-2"><Check className="size-4 shrink-0 text-primary" />{item}</li>)}
        </ul>
      </div>
      <AuthButton mode="signup" className="shrink-0">免费注册</AuthButton>
    </div>
  </section>;
}
