"use client";

/** 一条分享链接的访问明细：何时、大致在哪、用什么设备打开。计数规则见 app/lib/view-policy.ts */
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import type { ShareViewEntry } from "@/app/lib/shares";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type Detail = { views: ShareViewEntry[]; recorded: number; visitors: number };

const formatTime = (date: string) => new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string) {
  if (!code || code === "XX" || code === "T1") return "";
  try {
    regionNames ??= new Intl.DisplayNames(["zh-CN"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function ShareViewsDialog({ linkId, target, views }: { linkId: string; target: string; views: number }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError("");
    fetch(`/api/shares/${linkId}/views`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Detail & { error?: string };
        if (!response.ok) throw new Error(data.error || "暂时无法读取访问记录");
        if (active) setDetail(data);
      })
      .catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [open, linkId]);

  // 明细上线前累计的次数没有逐条记录，单独说明
  const earlier = detail ? Math.max(0, views - detail.recorded) : 0;

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button type="button" className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"><Eye className="size-3" />{views} 次访问</button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>访问记录</DialogTitle>
        <DialogDescription>「{target}」的链接。你自己打开、链接卡片预览和 30 分钟内的重复打开不计入</DialogDescription>
      </DialogHeader>
      {error ? <p className="py-6 text-center text-sm text-destructive" role="alert">{error}</p>
        : !detail ? <div className="grid gap-2" role="status" aria-label="正在读取访问记录">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-10 rounded-md" />)}</div>
        : <>
          <p className="text-sm text-muted-foreground">共 {detail.recorded} 次，约 {detail.visitors} 位不同访客{earlier > 0 && `；另有 ${earlier} 次为启用明细前的旧计数，可能包含链接预览和你自己的访问`}</p>
          {detail.views.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">还没有人打开过这条链接</p>
            : <ul className="-mx-1 max-h-80 divide-y overflow-y-auto px-1">
              {detail.views.map((view, index) => {
                const where = [countryName(view.country), view.place].filter(Boolean).join(" · ") || "未知地区";
                return <li key={`${view.viewedAt}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="shrink-0 tabular-nums">{formatTime(view.viewedAt)}</span>
                  <span className="min-w-0 truncate text-right text-muted-foreground">{where} · {view.device} · {view.browser}</span>
                </li>;
              })}
            </ul>}
          {detail.recorded > detail.views.length && <p className="text-xs text-muted-foreground">仅显示最近 {detail.views.length} 次</p>}
        </>}
    </DialogContent>
  </Dialog>;
}
