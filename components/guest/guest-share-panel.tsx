"use client";

/**
 * 游客的分享链接面板。分享后端尚未实现（登录用户同样如此），这里的链接只存在本页内存、打开的是示例分享页；
 * 规则按需求 6.3 节：最多 3 条有效链接，有效期 1/2/7 天，且不能晚于简历自动删除时间。
 * 「分享」发一句话加链接：手机走系统分享面板，不支持时复制文字和链接；电脑端另有二维码，方便对方用手机扫开。
 * 「发送到」只提供私聊类渠道（Telegram、WhatsApp、邮件），不提供 X/Facebook 等公开发帖。
 */
import { useEffect, useState } from "react";
import { Check, Clock3, Copy, Eye, Info, Link2, Mail, Plus, Power, QrCode, Send, Share } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { GUEST_LINK_DAYS, GUEST_MAX_LINKS } from "@/app/lib/guest-policy";
import type { Resume } from "@/app/lib/resumes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ShareLink = { id: string; target: string; note: string; createdAt: string; expiresAt: string; active: boolean; views: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const formatDateTime = (date: string) => new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));

export function GuestSharePanel({ resume }: { resume: Resume }) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState<(typeof GUEST_LINK_DAYS)[number]>(1);
  const [now] = useState(() => Date.now());
  const activeCount = links.filter((link) => link.active && new Date(link.expiresAt).getTime() > now).length;
  const full = activeCount >= GUEST_MAX_LINKS;
  const deleteAt = resume.deleteAt ? new Date(resume.deleteAt).getTime() : Infinity;
  const capped = now + days * DAY_MS > deleteAt;

  function create(event: React.FormEvent) {
    event.preventDefault();
    if (full) return;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Math.min(Date.now() + days * DAY_MS, deleteAt)).toISOString();
    setLinks((current) => [{ id: crypto.randomUUID(), target: target.trim() || "未命名对象", note: note.trim(), createdAt, expiresAt, active: true, views: 0 }, ...current]);
    setTarget(""); setNote(""); setDays(1);
    toast.success("链接已创建", { description: "复制后发给对方即可。" });
  }

  function toggle(id: string) {
    const link = links.find((item) => item.id === id);
    if (!link) return;
    if (!link.active && full) { toast.error(`游客最多同时保留 ${GUEST_MAX_LINKS} 条有效链接，请先失活其他链接。`); return; }
    setLinks((current) => current.map((item) => item.id === id ? { ...item, active: !item.active } : item));
    toast.success(link.active ? "链接已失活，对方将无法再打开。" : "链接已重新启用，有效期不变。");
  }

  return <section id="guest-share" aria-labelledby="share-title" className="scroll-mt-20 rounded-xl border bg-card print:hidden">
    <div className="border-b px-5 py-4 sm:px-6">
      <h2 id="share-title" className="font-semibold">分享链接</h2>
      <p className="mt-1 text-sm text-muted-foreground">为每家公司或联系人单独创建一条链接。游客最多同时保留 {GUEST_MAX_LINKS} 条有效链接，有效期最长 7 天。</p>
      <p className="mt-3 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" />演示：分享功能尚未接入后端。链接暂时打开示例分享页，列表只保存在当前页面，刷新后清空。</p>
    </div>

    <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <form onSubmit={create} className="grid content-start gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="share-target">分享对象 <span className="font-normal text-muted-foreground">（仅自己可见）</span></Label>
          <Input id="share-target" value={target} onChange={(event) => setTarget(event.target.value)} maxLength={40} placeholder="例如：示例公司 A · 产品岗" />
        </div>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">有效期</legend>
          <div className="grid grid-cols-3 gap-2">
            {GUEST_LINK_DAYS.map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}
              className={cn("h-10 rounded-md border text-sm transition-colors", days === value ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/40")}>{value} 天</button>)}
          </div>
          <p className="text-xs text-muted-foreground">{capped ? "你的简历会更早自动删除，链接将在那时一起失效。" : "自定义日期和永久有效需注册后使用。"}</p>
        </fieldset>
        <div className="grid gap-1.5">
          <Label htmlFor="share-note">投递留言 <span className="font-normal text-muted-foreground">（可选，对方可见）</span></Label>
          <Textarea id="share-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} rows={3} placeholder="您好，我想应聘贵司的……" />
        </div>
        <Button type="submit" disabled={full}><Plus />{full ? `已达 ${GUEST_MAX_LINKS} 条上限` : "创建链接"}</Button>
      </form>

      <div className="min-w-0">
        {links.length === 0 ? <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <Link2 className="size-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">还没有链接。创建后可以复制，或直接发送到聊天应用。</p>
        </div> : <ul className="grid gap-3">
          {links.map((link) => <LinkRow key={link.id} link={link} now={now} onToggle={() => toggle(link.id)} />)}
        </ul>}
      </div>
    </div>
  </section>;
}

function LinkRow({ link, now, onToggle }: { link: ShareLink; now: number; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);
  const expired = new Date(link.expiresAt).getTime() <= now;
  const usable = link.active && !expired;
  const url = `${window.location.origin}/s/demo`;
  const greeting = link.note || "您好，这是我的简历，请查阅。";
  const message = `${greeting}\n${url}`;

  async function share() {
    if (typeof navigator.share === "function") {
      // 用户取消分享面板也会 reject，静默即可
      await navigator.share({ title: "我的简历", text: greeting, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(message);
    toast.success("文字和链接已复制", { description: "粘贴到聊天或邮件里发给对方即可。" });
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("链接已复制");
    setTimeout(() => setCopied(false), 2000);
  }

  return <li className={cn("rounded-lg border p-4", !usable && "bg-muted/40")}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{link.target}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>创建于 {formatDateTime(link.createdAt)}</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{expired ? "已过期" : `${formatDateTime(link.expiresAt)} 到期`}</span>
          <span className="inline-flex items-center gap-1"><Eye className="size-3" />{link.views} 次访问</span>
        </p>
      </div>
      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", usable ? "bg-success/12 text-success" : expired ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning")}>{usable ? "有效" : expired ? "已过期" : "已失活"}</span>
    </div>
    {link.note && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">留言：{link.note}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" onClick={() => void share()} disabled={!usable}><Share />分享</Button>
      <Button size="sm" variant="outline" onClick={() => void copy()} disabled={!usable}>{copied ? <Check /> : <Copy />}复制链接</Button>
      {usable && <QrDialog url={url} target={link.target} />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={!usable}><Send />发送到</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild><a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(link.note || "您好，这是我的简历")}`} target="_blank" rel="noopener noreferrer"><Send />Telegram</a></DropdownMenuItem>
          <DropdownMenuItem asChild><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><Send />WhatsApp</a></DropdownMenuItem>
          <DropdownMenuItem asChild><a href={`mailto:?subject=${encodeURIComponent("我的简历")}&body=${encodeURIComponent(message)}`}><Mail />邮件</a></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!expired && <Button size="sm" variant="ghost" onClick={onToggle}><Power />{link.active ? "失活" : "重新启用"}</Button>}
    </div>
  </li>;
}

// 二维码只在电脑端提供：手机上自己扫自己的屏幕没有意义
function QrDialog({ url, target }: { url: string; target: string }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!open || src) return;
    void QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then(setSrc);
  }, [open, src, url]);

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline" className="hidden sm:inline-flex"><QrCode />二维码</Button></DialogTrigger>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>扫码打开简历</DialogTitle>
        <DialogDescription>「{target}」的链接。对方用手机扫一扫即可查看，无需注册。</DialogDescription>
      </DialogHeader>
      <div className="mx-auto grid size-60 place-items-center rounded-lg border bg-white p-3">
        {src ? <img src={src} alt="分享链接二维码" className="size-full" /> : <span className="text-sm text-muted-foreground">生成中…</span>}
      </div>
      <p className="truncate text-center text-xs text-muted-foreground">{url}</p>
    </DialogContent>
  </Dialog>;
}
