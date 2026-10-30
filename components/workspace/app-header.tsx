"use client";

import { usePathname } from "next/navigation";
import { FileText, LogOut, Settings, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/site/brand";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Props = { user: { name: string; email: string }; admin: boolean };

export async function signOut() {
  try {
    const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!response.ok) throw new Error();
    window.location.href = "/";
  } catch {
    toast.error("退出失败，请重试");
  }
}

export function AppHeader({ user, admin }: Props) {
  const pathname = usePathname();
  const links = [
    { href: "/app", label: "我的简历", icon: FileText, active: pathname === "/app" },
    ...(admin ? [{ href: "/app/admin", label: "管理后台", icon: ShieldCheck, active: pathname.startsWith("/app/admin") }] : []),
  ];

  return <header className="sticky top-0 z-40 border-b bg-card print:hidden">
    <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
      <Brand href="/app" />
      <nav aria-label="工作区导航" className="flex items-center gap-1">
        {links.map((link) => <a key={link.href} href={link.href} aria-current={link.active ? "page" : undefined}
          className={cn("flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors", link.active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          <link.icon className="size-4" /><span className="hidden sm:inline">{link.label}</span>
        </a>)}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger className="ml-auto flex items-center gap-2.5 rounded-full p-1 pr-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:pr-3" aria-label="账户菜单">
          <Avatar className="size-8"><AvatarFallback className="bg-secondary text-sm font-medium text-secondary-foreground">{user.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
          <span className="hidden max-w-[160px] truncate text-sm font-medium sm:block">{user.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><a href="/app/settings"><Settings />账户设置</a></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/"><FileText />产品首页</Link></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}><LogOut />退出登录</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>;
}
