"use client";

/**
 * 接收方看到的简历分享页：优先阅读，其次打印/下载。
 * 公开信息卡与投递说明只在求职者填写时出现；示例页用虚构内容，并提供页数、缩放、适应宽度辅助阅读。
 * 真实分享渲染 PDF，并定期（及回到前台、网络恢复时）检查链接状态：停用或失效后立即移除简历内容；到期时刻本地直接移除，不等下一次检查。
 * 网络错误不当作失效，只等下一次检查。
 */
import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, Info, Mail, MapPin, Maximize2, Minus, Phone, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/site/brand";
import { Button } from "@/components/ui/button";
import type { DemoShare, ResumeContent } from "@/lib/demo-data";
import { PdfPreview } from "@/components/workspace/pdf-preview";
import { ResumePaper } from "./resume-paper";
import { ShareUnavailable } from "./share-unavailable";
import Link from "next/link";

const PAGE_WIDTH = 794; // A4 在 96dpi 下的宽度
const PAGES = [1, 2] as const;
const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5];

const STATUS_INTERVAL_MS = 30_000;
// setTimeout 的最大延迟（约 24.8 天），更远的到期时间交给定期检查
const MAX_TIMEOUT_MS = 2_147_483_647;

type Props =
  | { share: DemoShare; resume: ResumeContent; demo: true }
  | { share: DemoShare; token: string; demo?: false };

export function ShareViewer(props: Props) {
  const { share, demo } = props;
  // null 表示「适应宽度」
  const [zoom, setZoom] = useState<number | null>(null);
  const [gone, setGone] = useState<"inactive" | "missing" | null>(null);
  const [printReady, setPrintReady] = useState(false);
  const token = props.demo ? null : props.token;
  const fileUrl = token ? `/api/s/${token}/file` : "";
  const { profile } = share;
  const hasProfile = Boolean(profile.name || profile.role || profile.location || profile.email || profile.phone);
  const current = zoom ?? 1;

  function step(direction: 1 | -1) {
    const index = ZOOM_STEPS.findIndex((value) => value >= current - 0.001);
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (index === -1 ? 3 : index) + direction))];
    setZoom(next);
  }

  const check = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`/api/s/${token}`, { cache: "no-store" });
      if (!response.ok) return;
      const { state } = await response.json() as { state: string };
      if (state === "inactive" || state === "missing") setGone(state);
    } catch {
      // 网络中断不代表链接失效
    }
  }, [token]);

  // 页面真正在浏览器里打开后上报一次访问；链接卡片抓取不执行脚本，不会走到这里
  useEffect(() => {
    if (!token) return;
    void fetch(`/api/s/${token}/view`, { method: "POST", keepalive: true }).catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") void check(); }, STATUS_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onVisible); };
  }, [token, check]);

  useEffect(() => {
    if (!share.expiresAt) return;
    const delay = new Date(share.expiresAt).getTime() - Date.now();
    if (delay > MAX_TIMEOUT_MS) return;
    const timer = setTimeout(() => setGone("missing"), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [share.expiresAt]);

  if (gone) return <ShareUnavailable state={gone} />;

  return <div className="flex min-h-screen flex-col bg-[#e9edf2] print:block print:bg-white">
    <header className="border-b bg-card print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        <p className="text-sm text-muted-foreground">简历预览 <span className="hidden sm:inline">· 通过链接查看</span></p>
      </div>
    </header>

    {demo && <div className="border-b border-warning/30 bg-warning/10 print:hidden">
      <p className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-sm sm:px-6"><Info className="size-4 shrink-0 text-warning" />这是使用虚构内容的示例分享页，用来展示招聘方打开链接后看到的样子</p>
    </div>}

    {(hasProfile || share.note) && <section aria-label="分享者公开信息" className="border-b bg-card print:hidden">
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-5 sm:px-6 md:grid-cols-[1fr_1.2fr] md:items-center">
        {hasProfile && <div>
          {profile.name && <h1 className="text-xl font-bold">{profile.name}</h1>}
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {profile.role && <li>{profile.role}</li>}
            {profile.location && <li className="flex items-center gap-1"><MapPin className="size-3.5" />{profile.location}</li>}
            {profile.email && <li><a className="flex items-center gap-1 text-primary hover:underline" href={`mailto:${profile.email}`}><Mail className="size-3.5" />{profile.email}</a></li>}
            {profile.phone && <li><a className="flex items-center gap-1 text-primary hover:underline" href={`tel:${profile.phone}`}><Phone className="size-3.5" />{profile.phone}</a></li>}
          </ul>
        </div>}
        {share.note && <div className="rounded-lg bg-muted px-4 py-3">
          <p className="text-xs text-muted-foreground">留言</p>
          <p className="mt-1 text-[15px] leading-relaxed">{share.note}</p>
        </div>}
      </div>
    </section>}

    {/* 阅读工具栏 */}
    <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <p className="min-w-0 truncate text-sm text-muted-foreground"><span className="font-medium text-foreground">简历</span> · {demo ? `共 ${PAGES.length} 页` : share.fileName}</p>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {demo && <div className="hidden items-center rounded-md border sm:flex" role="group" aria-label="缩放">
            <Button variant="ghost" size="icon" className="rounded-r-none" onClick={() => step(-1)} disabled={current <= ZOOM_STEPS[0]} aria-label="缩小"><Minus /></Button>
            <span className="w-14 text-center text-sm tabular-nums" aria-live="polite">{zoom === null ? "适应" : `${Math.round(current * 100)}%`}</span>
            <Button variant="ghost" size="icon" className="rounded-l-none" onClick={() => step(1)} disabled={current >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} aria-label="放大"><Plus /></Button>
          </div>}
          {demo && <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => setZoom(null)} aria-pressed={zoom === null}><Maximize2 />适应宽度</Button>}
          <Button variant="outline" onClick={() => window.print()} disabled={!demo && !printReady}><Printer /><span className="hidden sm:inline">打印</span></Button>
          {demo ? <Button onClick={() => toast.info("这是示例页面，没有可下载的文件")}><ArrowDownToLine /><span className="hidden sm:inline">下载</span></Button>
            : <Button asChild><a href={`${fileUrl}?download=1`} download><ArrowDownToLine /><span className="hidden sm:inline">下载</span></a></Button>}
        </div>
      </div>
    </div>

    <main id="main" className="flex-1 overflow-x-auto px-3 py-6 sm:px-6 sm:py-10 print:overflow-visible print:p-0">
      {props.demo ? <div className="mx-auto flex flex-col gap-6 print:block print:w-full!" style={{ width: zoom === null ? `min(100%, ${PAGE_WIDTH}px)` : `${PAGE_WIDTH * zoom}px` }}>
        {PAGES.map((page) => <div key={page} className="break-after-page last:break-after-auto">
          <ResumePaper resume={props.resume} page={page} />
          <p className="mt-2 text-center text-xs text-muted-foreground print:hidden">第 {page} / {PAGES.length} 页</p>
        </div>)}
      </div> : <div className="mx-auto print:w-full" style={{ width: `min(100%, ${PAGE_WIDTH}px)` }}>
        <PdfPreview url={fileUrl} onReady={setPrintReady} />
      </div>}
      <p className="mt-6 text-center text-xs text-muted-foreground sm:hidden print:hidden">手机无法直接打印时，可下载后再打印</p>
    </main>

    <footer className="border-t bg-card print:hidden">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
        <p>此简历由分享者提供，内容由其本人负责</p>
        <nav className="flex gap-4"><a className="hover:text-foreground" href="/privacy">隐私说明</a><Link className="hover:text-foreground" href="/">简历口袋首页</Link></nav>
      </div>
    </footer>
  </div>;
}
