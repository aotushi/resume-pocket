"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, FileText, Link2, RefreshCw, Users } from "lucide-react";
import type { Statistics } from "@/app/lib/statistics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "./page-header";

const number = new Intl.NumberFormat("zh-CN");
const statuses = [
  { key: "active", label: "生效中", color: "bg-primary" },
  { key: "inactive", label: "已停用", color: "bg-muted-foreground" },
  { key: "expired", label: "已过期", color: "bg-warning" },
  { key: "missing", label: "文件已删除或到期", color: "bg-border" },
] as const;

export function StatisticsDashboard({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<Statistics | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const endpoint = admin ? "/api/admin/stats" : "/api/stats";
  const load = useCallback((signal?: AbortSignal) => fetch(endpoint, { cache: "no-store", signal })
    .then(async (response) => {
      const result = await response.json() as Statistics & { error?: string };
      if (!response.ok) throw new Error(result.error || "暂时无法读取统计");
      if (!signal?.aborted) setData(result);
    }).catch((cause) => {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "请稍后重试");
    }).finally(() => { if (!signal?.aborted) setBusy(false); }), [endpoint]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  return <div>
    <PageHeader title={admin ? "管理后台" : "数据统计"}
      description={admin ? "全站简历与分享使用情况，仅展示汇总数据" : "查看自己的简历、分享状态与访问情况"}
      actions={<Button variant="outline" className="min-h-11" disabled={busy} onClick={() => { setBusy(true); setError(""); void load(); }}><RefreshCw className={busy ? "animate-spin" : ""} />{busy ? "更新中…" : "刷新数据"}</Button>} />
    {error && <p role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}{data && "。下方保留上次成功读取的数据。"}</p>}
    {!data && !error && <div className="mt-8 grid gap-4 sm:grid-cols-3" role="status" aria-label="正在读取真实统计"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>}
    {data && <div className="mt-8 space-y-6" aria-busy={busy}>
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${admin ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}>
        {data.users && <Stat icon={Users} label="已验证用户" value={data.users.total} hint={`近 7 天注册 ${number.format(data.users.new7d)} 位`} />}
        <Stat icon={FileText} label="简历数量" value={data.resumes} hint="当前可用的简历，更新版本不重复计数" />
        <Stat icon={Link2} label="分享链接" value={data.shares.total} hint={`生效中 ${number.format(data.shares.active)} 条`} />
        <Stat icon={Eye} label="分享页访问" value={data.views} hint={`近 7 天记录 ${number.format(data.recentViews)} 次`} />
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader><CardTitle>近 7 天访问</CardTitle><CardDescription>按北京时间统计分享页访问，不含文件请求和状态检查</CardDescription></CardHeader>
          <CardContent>
            <ol className="grid h-52 grid-cols-7 items-end gap-2" aria-label="每日分享页访问次数">
              {data.trend.map((day) => <li key={day.day} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                <span className="text-xs font-medium tabular-nums">{number.format(day.views)}</span>
                <div className="w-full max-w-10 rounded-t bg-primary/85" aria-hidden="true" style={{ height: `${Math.max(day.views ? 4 : 1, day.views / Math.max(1, ...data.trend.map((item) => item.views)) * 140)}px` }} />
                <span className="text-[11px] text-muted-foreground tabular-nums">{day.day.slice(5).replace("-", "/")}</span>
              </li>)}
            </ol>
            {data.recentViews === 0 && <p className="mt-4 text-center text-sm text-muted-foreground">这段时间还没有记录到访问</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>分享状态</CardTitle><CardDescription>每条链接只计入一种状态</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              {statuses.map((item) => <div key={item.key} className={item.color} style={{ width: `${data.shares.total ? data.shares[item.key] / data.shares.total * 100 : 0}%` }} />)}
            </div>
            <ul className="space-y-3">{statuses.map((item) => <li key={item.key} className="flex items-center gap-3 text-sm">
              <span className={`size-2.5 rounded-full ${item.color}`} aria-hidden="true" /><span className="flex-1">{item.label}</span><span className="font-medium tabular-nums">{number.format(data.shares[item.key])}</span>
            </li>)}</ul>
          </CardContent>
        </Card>
      </div>
      {data.resumeRows && <Card>
        <CardHeader><CardTitle>按简历查看</CardTitle><CardDescription>进入对应简历可管理链接、停用或重新启用，并查看访问明细</CardDescription></CardHeader>
        <CardContent>
          {data.resumeRows.length === 0 ? <div className="py-4 text-center"><p className="mb-4 text-sm text-muted-foreground">上传第一份简历后，这里就会显示统计</p><Button asChild><Link href="/app">上传简历<ArrowRight /></Link></Button></div>
            : <ul className="divide-y">{data.resumeRows.map((resume) => <li key={resume.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="break-all font-medium">{resume.name}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{resume.shares.total} 条链接 · 生效 {resume.shares.active} · 停用 {resume.shares.inactive} · 过期 {resume.shares.expired}</p></div>
              <div className="flex items-center justify-between gap-4"><p className="whitespace-nowrap text-sm tabular-nums">{number.format(resume.views)} 次访问</p><Button asChild variant="outline" className="min-h-11"><Link href={`/app?resume=${resume.id}`}>管理链接<ArrowRight /></Link></Button></div>
            </li>)}</ul>}
        </CardContent>
      </Card>}
      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        <p>更新于 {new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date(data.generatedAt))}（北京时间）</p>
        <p>只统计当前保留的简历与分享记录，删除后不再计入。访问次数不等于阅读人数；本人访问、已识别的自动预览及同一访客 30 分钟内的重复访问不计入。历史累计次数可能包含启用明细前的旧计数，近 7 天仅统计已记录明细。</p>
        {admin && <p>全站范围包括注册用户和游客空间。首页访问尚未采集；此处不展示他人的简历内容、联系方式、私人备注或分享标识。</p>}
      </div>
    </div>}
  </div>;
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Eye; label: string; value: number; hint: string }) {
  return <Card className="gap-3 py-5"><CardHeader className="flex items-center justify-between px-5"><CardDescription>{label}</CardDescription><Icon className="size-5 text-primary" /></CardHeader><CardContent className="px-5"><p className="text-3xl font-semibold tabular-nums">{number.format(value)}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p></CardContent></Card>;
}
