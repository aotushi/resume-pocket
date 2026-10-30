"use client";

/**
 * 一份简历的分享链接面板，注册用户与游客共用，对接 /api/shares。
 * 规则见需求 6.3、7 节：游客最多 3 条有效链接、有效期 1/2/7 天且不晚于简历删除时间；
 * 注册用户另有自定义日期与永久有效。重新启用不改变原有效期，已过期的链接只能删除后新建。
 * 「分享」发一句话加链接：手机走系统分享面板，不支持时复制文字和链接；电脑端另有二维码，方便对方用手机扫开。
 * 「发送到」只提供私聊类渠道（Telegram、WhatsApp、邮件），不提供 X/Facebook 等公开发帖。
 * 「图片」把简历和这条链接的二维码拼成一张高清长图，一键生成，不提供选项。
 */
import { useCallback, useEffect, useState } from "react";
import { Ban, Check, ChevronDown, Clock3, Copy, ImageDown, Infinity as InfinityIcon, Link2, Mail, MoreHorizontal, Plus, QrCode, RotateCcw, Send, Share, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { GUEST_LINK_DAYS } from "@/app/lib/guest-policy";
import type { Resume } from "@/app/lib/resumes";
import type { ShareLinkView } from "@/app/lib/shares";
import { LINK_DAYS, maxLinks, NOTE_MAX, PROFILE_FIELDS, type ShareProfile, shareStatus, TARGET_MAX, USER_MAX_CUSTOM_DAYS } from "@/app/lib/share-policy";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { renderShareImage, saveShareImage } from "@/lib/share-image";
import { cn } from "@/lib/utils";
import { ShareViewsDialog } from "./share-views-dialog";

type Expiry = { kind: "days"; days: number } | { kind: "until" } | { kind: "permanent" };

const DAY_MS = 24 * 60 * 60 * 1000;
const formatDateTime = (date: string) => new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
const localDate = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const profileLabels: Record<(typeof PROFILE_FIELDS)[number], { label: string; placeholder: string; type?: string }> = {
  name: { label: "姓名", placeholder: "例如：林晓" },
  role: { label: "目标岗位", placeholder: "例如：产品经理" },
  location: { label: "所在地", placeholder: "例如：上海" },
  email: { label: "邮箱", placeholder: "name@example.com", type: "email" },
  phone: { label: "电话", placeholder: "例如：138-0000-0000", type: "tel" },
};

async function errorOf(response: Response, fallback: string) {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return data?.error || fallback;
}

export function ShareLinksPanel({ resume, guest = false }: { resume: Resume; guest?: boolean }) {
  const [links, setLinks] = useState<ShareLinkView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [profile, setProfile] = useState<ShareProfile>({});
  const [expiry, setExpiry] = useState<Expiry>({ kind: "days", days: 1 });
  const [until, setUntil] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{ action: "enable" | "delete"; link: ShareLinkView } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const limit = maxLinks(guest ? "guest" : "user");
  const usableCount = links.filter((link) => statusOf(link, now) === "active").length;
  const full = usableCount >= limit;
  const deleteAt = resume.deleteAt ? new Date(resume.deleteAt).getTime() : Infinity;
  const capped = expiry.kind === "days" && now + expiry.days * DAY_MS > deleteAt;

  const load = useCallback(() => {
    fetch(`/api/shares?resume=${resume.id}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorOf(response, "暂时无法读取分享链接"));
        const data = await response.json() as { links: ShareLinkView[] };
        setLinks(data.links);
        setNow(Date.now());
        setLoadError("");
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, [resume.id]);

  useEffect(load, [load]);

  // 到期状态按本地时间每分钟刷新一次
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (full || creating) return;
    let choice: object;
    if (expiry.kind === "days") choice = { days: expiry.days };
    else if (expiry.kind === "permanent") choice = { permanent: true };
    else {
      if (!until) { toast.error("请选择截止日期"); return; }
      // 自定义日期截止到当天结束（本地时间）
      choice = { until: new Date(`${until}T23:59:59`).toISOString() };
    }
    setCreating(true);
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id, target, note, profile, expiry: choice }),
      });
      if (!response.ok) throw new Error(await errorOf(response, "创建失败，请稍后重试"));
      const { link } = await response.json() as { link: ShareLinkView };
      setLinks((current) => [link, ...current]);
      setNow(Date.now());
      setTarget(""); setNote(""); setExpiry({ kind: "days", days: 1 }); setUntil("");
      toast.success("链接已创建", { description: "点「分享」或「复制链接」发给对方即可" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败，请稍后重试");
    } finally {
      setCreating(false);
    }
  }

  async function setActive(link: ShareLinkView, active: boolean) {
    setBusyId(link.id);
    try {
      const response = await fetch(`/api/shares/${link.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
      if (!response.ok) throw new Error(await errorOf(response, "操作失败，请稍后重试"));
      const { link: updated } = await response.json() as { link: ShareLinkView };
      setLinks((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success(active ? "链接已重新启用，有效期不变" : "链接已停用，对方将无法再打开");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败，请稍后重试");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(link: ShareLinkView) {
    setBusyId(link.id);
    try {
      const response = await fetch(`/api/shares/${link.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw new Error(await errorOf(response, "删除失败，请稍后重试"));
      setLinks((current) => current.filter((item) => item.id !== link.id));
      toast.success("链接已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败，请稍后重试");
    } finally {
      setBusyId(null);
    }
  }

  const dayOptions: readonly number[] = guest ? GUEST_LINK_DAYS : LINK_DAYS;
  const option = (selected: boolean) => cn("h-10 rounded-md border text-sm transition-colors", selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/40");

  return <section id="share-links" aria-labelledby="share-title" className="scroll-mt-20 rounded-xl border bg-card print:hidden">
    <div className="border-b px-5 py-4 sm:px-6">
      <h2 id="share-title" className="font-semibold">分享链接</h2>
      <p className="mt-1 text-sm text-muted-foreground">{guest
        ? `为每家公司或联系人单独创建一条链接。游客最多同时保留 ${limit} 条有效链接，有效期最长 7 天。`
        : `为每家公司或联系人单独创建一条链接，随时可以停用。每份简历最多同时保留 ${limit} 条有效链接。`}</p>
    </div>

    <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <form onSubmit={create} className="grid content-start gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="share-target">分享对象 <span className="font-normal text-muted-foreground">（仅自己可见）</span></Label>
          <Input id="share-target" value={target} onChange={(event) => setTarget(event.target.value)} maxLength={TARGET_MAX} placeholder="例如：示例公司 A · 产品岗" />
        </div>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">有效期</legend>
          <div className="grid grid-cols-3 gap-2">
            {dayOptions.map((value) => <button key={value} type="button" aria-pressed={expiry.kind === "days" && expiry.days === value} onClick={() => setExpiry({ kind: "days", days: value })}
              className={option(expiry.kind === "days" && expiry.days === value)}>{value} 天</button>)}
            {!guest && <>
              <button type="button" aria-pressed={expiry.kind === "until"} onClick={() => setExpiry({ kind: "until" })} className={option(expiry.kind === "until")}>自定义</button>
              <button type="button" aria-pressed={expiry.kind === "permanent"} onClick={() => setExpiry({ kind: "permanent" })} className={option(expiry.kind === "permanent")}>永久</button>
            </>}
          </div>
          {expiry.kind === "until" && <Input type="date" aria-label="截止日期" className="mt-1" value={until} onChange={(event) => setUntil(event.target.value)}
            min={localDate(now)} max={localDate(now + (USER_MAX_CUSTOM_DAYS - 1) * DAY_MS)} />}
          <p className="text-xs text-muted-foreground">{guest
            ? capped ? "你的简历会更早自动删除，链接将在那时一起失效" : "自定义日期和永久有效需注册后使用"
            : expiry.kind === "permanent" ? "永久有效的链接不会自动到期，不再需要时请手动停用"
              : expiry.kind === "until" ? "链接在所选日期当天结束时到期" : "到期后对方将无法再打开"}</p>
        </fieldset>
        <div className="grid gap-1.5">
          <Label htmlFor="share-note">投递留言 <span className="font-normal text-muted-foreground">（可选，对方可见）</span></Label>
          <Textarea id="share-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={NOTE_MAX} rows={3} placeholder="您好，我想应聘贵司的……" />
        </div>
        <details className="group rounded-lg border px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
            <span>公开信息卡 <span className="font-normal text-muted-foreground">（可选，对方可见）</span></span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">显示在分享页顶部，只填你想让这家公司看到的项目，不会自动使用账户或简历里的资料</p>
          <div className="mt-3 grid gap-3 pb-1">
            {PROFILE_FIELDS.map((field) => <div key={field} className="grid gap-1">
              <Label htmlFor={`share-profile-${field}`} className="text-xs">{profileLabels[field].label}</Label>
              <Input id={`share-profile-${field}`} type={profileLabels[field].type ?? "text"} value={profile[field] ?? ""} placeholder={profileLabels[field].placeholder}
                onChange={(event) => setProfile((current) => ({ ...current, [field]: event.target.value }))} />
            </div>)}
          </div>
        </details>
        <Button type="submit" disabled={full || creating}>{creating ? <Spinner /> : <Plus />}{full ? `已达 ${limit} 条上限` : creating ? "创建中…" : "创建链接"}</Button>
      </form>

      <div className="min-w-0">
        {loading ? <div className="grid gap-3" role="status" aria-label="正在读取分享链接">{[0, 1].map((key) => <Skeleton key={key} className="h-32 rounded-lg" />)}</div>
          : loadError ? <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center" role="alert">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); load(); }}>重试</Button>
          </div>
          : links.length === 0 ? <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
            <Link2 className="size-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">还没有链接。创建后可以复制，或直接发送到聊天应用。</p>
          </div> : <ul className="grid gap-3">
            {links.map((link) => <LinkRow key={link.id} link={link} resume={resume} now={now} busy={busyId === link.id}
              onDisable={() => void setActive(link, false)}
              onEnable={() => setConfirm({ action: "enable", link })}
              onDelete={() => setConfirm({ action: "delete", link })} />)}
          </ul>}
      </div>
    </div>

    <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm?.action === "enable" ? "重新启用这条链接？" : "删除这条链接？"}</AlertDialogTitle>
          <AlertDialogDescription className="break-all">{confirm?.action === "enable"
            ? `「${confirm.link.target}」将恢复访问，有效期不变。此前拿到或被转发了这条链接的人都能再次打开。`
            : `「${confirm?.link.target}」将被永久删除，对方无法再打开，访问次数也一并清除。`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction className={cn(confirm?.action === "delete" && "bg-destructive text-white hover:bg-destructive/90")} onClick={() => {
            if (!confirm) return;
            if (confirm.action === "enable") void setActive(confirm.link, true); else void remove(confirm.link);
          }}>{confirm?.action === "enable" ? "重新启用" : "确认删除"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

function statusOf(link: ShareLinkView, now: number) {
  return shareStatus({ active: link.active, expiresAt: link.expiresAt ? new Date(link.expiresAt) : null }, new Date(now));
}

type RowProps = { link: ShareLinkView; resume: Resume; now: number; busy: boolean; onDisable: () => void; onEnable: () => void; onDelete: () => void };

function LinkRow({ link, resume, now, busy, onDisable, onEnable, onDelete }: RowProps) {
  const [copied, setCopied] = useState(false);
  const [imaging, setImaging] = useState(false);
  const status = statusOf(link, now);
  const expired = Boolean(link.expiresAt && new Date(link.expiresAt).getTime() <= now);
  const url = link.url;
  const usable = status === "active" && Boolean(url);
  const greeting = link.note || "您好，这是我的简历，请查阅。";
  const message = `${greeting}\n${url}`;

  async function share() {
    if (!url) return;
    if (typeof navigator.share === "function") {
      // 用户取消分享面板也会 reject，静默即可
      await navigator.share({ title: "我的简历", text: greeting, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(message);
    toast.success("文字和链接已复制", { description: "粘贴到聊天或邮件里发给对方即可" });
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("链接已复制");
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveImage() {
    if (!url || imaging) return;
    setImaging(true);
    try {
      const blob = await renderShareImage({ fileUrl: `/api/resumes/${resume.id}?v=${encodeURIComponent(resume.version)}`, shareUrl: url, expiresAt: link.expiresAt, profile: link.profile, note: link.note });
      const filename = `${[resume.name.replace(/\.[^.]+$/, ""), link.target].join("-").replace(/[\\/:*?"<>|\s]+/g, "_")}.png`;
      await saveShareImage(blob, filename);
      toast.success("图片已生成", { description: "图片发出后无法收回，停用链接只会让二维码失效" });
    } catch (error) {
      console.error("Could not create share image", error);
      toast.error("图片生成失败，请稍后重试");
    } finally {
      setImaging(false);
    }
  }

  const badge = { active: "有效", inactive: "已停用", expired: "已过期" }[status];
  return <li className={cn("rounded-lg border p-4", status !== "active" && "bg-muted/40")}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{link.target}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>创建于 {formatDateTime(link.createdAt)}</span>
          <span className="inline-flex items-center gap-1">{link.expiresAt ? <Clock3 className="size-3" /> : <InfinityIcon className="size-3" />}
            {!link.expiresAt ? "永久有效" : expired ? `已于 ${formatDateTime(link.expiresAt)} 到期` : `${formatDateTime(link.expiresAt)} 到期`}</span>
          <ShareViewsDialog linkId={link.id} target={link.target} views={link.views} />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", status === "active" ? "bg-success/12 text-success" : status === "expired" ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning")}>{badge}</span>
        {/* 停用和删除不常用，收进菜单，与分享操作分开以免误点 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" disabled={busy} aria-label={`「${link.target}」的更多操作`}>{busy ? <Spinner /> : <MoreHorizontal />}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {status === "active" && <DropdownMenuItem onSelect={onDisable}><Ban />停用</DropdownMenuItem>}
            <DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />删除</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    {link.note && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">留言：{link.note}</p>}
    {!url && <p className="mt-2 text-xs text-warning">这条链接的地址无法再次显示，如需继续分享请新建一条</p>}
    {usable && url && <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <Button size="sm" onClick={() => void share()}><Share />分享</Button>
      <Button size="sm" variant="outline" onClick={() => void copy()}>{copied ? <Check /> : <Copy />}复制链接</Button>
      <QrDialog url={url} target={link.target} />
      <Button size="sm" variant="outline" disabled={imaging} onClick={() => void saveImage()}>{imaging ? <Spinner /> : <ImageDown />}{imaging ? "生成中…" : "图片"}</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><Send />发送到</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild><a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(greeting)}`} target="_blank" rel="noopener noreferrer"><Send />Telegram</a></DropdownMenuItem>
          <DropdownMenuItem asChild><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><Send />WhatsApp</a></DropdownMenuItem>
          <DropdownMenuItem asChild><a href={`mailto:?subject=${encodeURIComponent("我的简历")}&body=${encodeURIComponent(message)}`}><Mail />邮件</a></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>}
    {status === "inactive" && !expired && <div className="mt-3"><Button size="sm" variant="outline" disabled={busy} onClick={onEnable}>{busy ? <Spinner /> : <RotateCcw />}启用</Button></div>}
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
