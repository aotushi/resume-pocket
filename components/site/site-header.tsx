"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { AuthButton } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Brand } from "./brand";

const links = [
  { href: "/#how", label: "使用方式" },
  { href: "/#demo", label: "效果演示" },
  { href: "/#features", label: "产品功能" },
  { href: "/#scenarios", label: "适用场景" },
  { href: "/#faq", label: "常见问题" },
];

/** 营销页（首页、隐私、服务说明）共用的吸顶导航 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
      <Brand />
      <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
        {links.map((link) => <a key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{link.label}</a>)}
      </nav>
      <div className="hidden items-center gap-2 md:flex">
        {signedIn ? <Button asChild><Link href="/app">进入工作区</Link></Button> : <>
          <AuthButton variant="ghost" mode="signin">登录</AuthButton>
          <AuthButton mode="signup">开始使用</AuthButton>
        </>}
      </div>

      <Sheet>
        <SheetTrigger asChild><Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label="打开菜单"><Menu className="size-5" /></Button></SheetTrigger>
        <SheetContent side="right" className="w-[280px]">
          <SheetHeader><SheetTitle className="text-left">菜单</SheetTitle></SheetHeader>
          <nav aria-label="移动端导航" className="grid gap-1 px-4">
            {links.map((link) => <SheetClose asChild key={link.href}><a href={link.href} className="flex h-11 items-center rounded-md px-3 text-[15px] hover:bg-muted">{link.label}</a></SheetClose>)}
          </nav>
          <div className="mt-4 grid gap-2 border-t px-4 pt-4">
            {signedIn ? <Button asChild size="lg"><Link href="/app">进入工作区</Link></Button> : <>
              <SheetClose asChild><AuthButton size="lg" mode="signup">开始使用</AuthButton></SheetClose>
              <SheetClose asChild><AuthButton size="lg" variant="outline" mode="signin">登录</AuthButton></SheetClose>
            </>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  </header>;
}
