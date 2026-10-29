"use client";

/**
 * 首页「按对象分享」演示：左侧是求职者的链接列表（虚构），右侧手机框是招聘方打开该链接看到的样子。
 * 点击不同链接即可对比有效、永久、已过期、已停用四种状态，说明「每条链接互不影响、随时可收回」。
 */
import { useState } from "react";
import { ArrowDownToLine, BatteryFull, CircleOff, Clock3, Eye, FileText, Infinity as InfinityIcon, Link2Off, Lock, MapPin, Printer, Signal, Wifi } from "lucide-react";
import { ResumePaper } from "@/components/share/resume-paper";
import { demoResume, demoShare } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

type LinkState = "active" | "permanent" | "expired" | "inactive";

const links: { id: string; target: string; created: string; expiry: string; state: LinkState; views: number; note: string }[] = [
  { id: "a", target: "示例公司 A · 产品岗", created: "10 月 28 日创建", expiry: "1 天后到期", state: "active", views: 3, note: "您好，我想应聘贵司的产品经理岗位，以下是我的简历，感谢查阅。" },
  { id: "b", target: "猎头 王女士", created: "9 月 2 日创建", expiry: "永久有效", state: "permanent", views: 7, note: "王女士您好，这是我最新的简历，方便时请帮我推荐合适的机会。" },
  { id: "c", target: "示例公司 B · 校招", created: "10 月 14 日创建", expiry: "已于 10 月 21 日到期", state: "expired", views: 2, note: "" },
  { id: "d", target: "示例公司 C", created: "10 月 25 日创建", expiry: "7 天有效 · 已手动停用", state: "inactive", views: 1, note: "" },
];

const stateMeta: Record<LinkState, { label: string; className: string }> = {
  active: { label: "有效", className: "bg-success/12 text-success" },
  permanent: { label: "永久", className: "bg-secondary text-primary" },
  expired: { label: "已过期", className: "bg-muted text-muted-foreground" },
  inactive: { label: "已停用", className: "bg-warning/15 text-warning" },
};

export function LinkStateDemo() {
  const [selectedId, setSelectedId] = useState("a");
  const selected = links.find((link) => link.id === selectedId) ?? links[0];
  const available = selected.state === "active" || selected.state === "permanent";

  return <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
    {/* 求职者视角 */}
    <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-xs text-muted-foreground">求职者看到的</p>
          <p className="mt-0.5 font-semibold">{demoShare.fileName} 的分享链接</p>
        </div>
        <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">示例</span>
      </div>
      <ul className="mt-3 grid gap-2" role="listbox" aria-label="示例链接，选择后查看招聘方视角">
        {links.map((link) => {
          const meta = stateMeta[link.state];
          const isSelected = link.id === selectedId;
          return <li key={link.id}>
            <button type="button" role="option" aria-selected={isSelected} onClick={() => setSelectedId(link.id)}
              className={cn("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                isSelected ? "border-primary bg-secondary/60 ring-1 ring-primary" : "bg-background hover:border-primary/40")}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{link.target}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{link.created}</span><span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">{link.state === "permanent" ? <InfinityIcon className="size-3.5" /> : <Clock3 className="size-3.5" />}{link.expiry}</span>
                </p>
              </div>
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Eye className="size-3.5" />{link.views}</span>
              <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", meta.className)}>{meta.label}</span>
            </button>
          </li>;
        })}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">每家公司一条独立链接：有效期、留言和状态各自独立，停用其中一条不影响其他链接。</p>
    </div>

    {/* 招聘方视角：手机框 */}
    <div className="mx-auto w-full max-w-[300px]">
      <p className="mb-3 text-center text-xs text-muted-foreground">招聘方打开「{selected.target}」的链接</p>
      <div className="rounded-[2.4rem] bg-[#1f2b3a] p-[7px] shadow-[0_24px_60px_-20px_rgb(24_40_60/.45)]">
        <div className="relative flex h-[560px] flex-col overflow-hidden rounded-[2rem] bg-[#e9edf2]" aria-live="polite">
          {/* 手机系统栏 + 浏览器地址栏：交代「这是在手机浏览器里打开的链接」 */}
          <div className="shrink-0 bg-card" aria-hidden>
            <div className="relative flex h-9 items-center justify-between px-6 text-[11px] font-semibold tabular-nums">
              <span>9:41</span>
              <span className="absolute top-2 left-1/2 h-[22px] w-[76px] -translate-x-1/2 rounded-full bg-[#1f2b3a]" />
              <span className="flex items-center gap-1"><Signal className="size-3" /><Wifi className="size-3" /><BatteryFull className="size-3.5" /></span>
            </div>
            <div className="px-3 pb-2">
              <div className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-muted text-[11px] text-muted-foreground"><Lock className="size-3" />resume-pocket/s/••••••</div>
            </div>
          </div>
          {/* 以下对应真实分享页（share-viewer）的手机布局：站点头 → 信息卡 → 阅读工具栏 → 简历 */}
          <div className="flex h-11 shrink-0 items-center justify-between border-y bg-card px-3.5" aria-hidden>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold"><span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground"><FileText className="size-3.5" /></span>简历口袋</span>
            <span className="text-[11px] text-muted-foreground">简历预览</span>
          </div>
          {available ? <div className="min-h-0 flex-1 overflow-hidden">
            <div className="border-b bg-card px-3.5 py-3">
              <p className="text-[15px] font-bold">{demoShare.profile.name}</p>
              <p className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">{demoShare.profile.role}<span className="inline-flex items-center gap-0.5"><MapPin className="size-3" />{demoShare.profile.location}</span></p>
              {selected.note && <div className="mt-2.5 rounded-md bg-muted px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground">留言</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">{selected.note}</p>
              </div>}
            </div>
            <div className="flex h-11 items-center justify-between border-b bg-card px-3.5" aria-hidden>
              <span className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">简历</span> · 共 2 页</span>
              <span className="flex gap-1.5">
                <span className="grid size-7 place-items-center rounded-md border text-foreground"><Printer className="size-3.5" /></span>
                <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"><ArrowDownToLine className="size-3.5" /></span>
              </span>
            </div>
            <div className="px-3 pt-3"><ResumePaper resume={demoResume} page={1} /></div>
          </div> : <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-card text-muted-foreground shadow-sm">
              {selected.state === "expired" ? <Link2Off className="size-5" /> : <CircleOff className="size-5" />}
            </span>
            <p className="mt-4 font-semibold">{selected.state === "expired" ? "链接已过期" : "链接已失效"}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{selected.state === "expired" ? "这条链接的有效期已结束，无法再查看简历。" : "分享者已停止共享这份简历。"}如有需要，请直接联系对方。</p>
            <p className="mt-6 text-[11px] text-muted-foreground">不显示简历内容与分享者资料</p>
          </div>}
          <span className="pointer-events-none absolute bottom-1.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-foreground/25" aria-hidden />
        </div>
      </div>
    </div>
  </div>;
}
