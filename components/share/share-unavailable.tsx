"use client";

/**
 * 分享链接不可用时接收方看到的页面（需求 7.3）：不显示任何简历或所有者信息。
 * 手动停用：提示后 5 秒自动回到首页，无脚本时由 meta refresh 兜底；其他失效情况只提供返回首页。
 */
import { useEffect, useState } from "react";
import { ArrowLeft, CircleOff, FileQuestion } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/site/brand";
import { Button } from "@/components/ui/button";

const REDIRECT_SECONDS = 5;

export function ShareUnavailable({ state }: { state: "inactive" | "missing" }) {
  const inactive = state === "inactive";
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (!inactive) return;
    const timer = setInterval(() => setSeconds((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [inactive]);

  useEffect(() => {
    if (inactive && seconds <= 0) window.location.replace("/");
  }, [inactive, seconds]);

  return <div className="flex min-h-screen flex-col">
    {inactive && <noscript><meta httpEquiv="refresh" content={`${REDIRECT_SECONDS};url=/`} /></noscript>}
    <header className="border-b bg-card"><div className="mx-auto flex h-14 max-w-6xl items-center px-5 sm:px-8"><Brand /></div></header>
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-20">
      <div className="max-w-md text-center" role="alert">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">{inactive ? <CircleOff className="size-7" /> : <FileQuestion className="size-7" />}</span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{inactive ? "此分享已停用" : "链接不存在或已失效"}</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">{inactive
          ? `分享者已关闭这条链接。${Math.max(seconds, 0)} 秒后返回首页。`
          : "这条分享链接可能已过期或已被删除。如需查看简历，请联系分享给你的人重新获取链接。"}</p>
        <Button asChild size="lg" className="mt-8"><Link href="/" replace><ArrowLeft />返回首页</Link></Button>
      </div>
    </main>
  </div>;
}
