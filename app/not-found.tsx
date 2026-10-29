import { ArrowLeft, FileQuestion } from "lucide-react";
import { Brand } from "@/components/site/brand";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// 分享页的失效链接也落到这里：只说明「不存在或已失效」，不泄露任何简历或所有者信息
export default function NotFound() {
  return <div className="flex min-h-screen flex-col">
    <header className="border-b bg-card"><div className="mx-auto flex h-14 max-w-6xl items-center px-5 sm:px-8"><Brand /></div></header>
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-20">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><FileQuestion className="size-7" /></span>
        <p className="mt-6 text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">页面不存在或链接已失效</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">你访问的地址可能有误，或这条分享链接已过期、被分享者关闭。如需查看简历，请联系分享给你的人重新获取链接。</p>
        <Button asChild size="lg" className="mt-8"><Link href="/"><ArrowLeft />返回首页</Link></Button>
      </div>
    </main>
  </div>;
}
