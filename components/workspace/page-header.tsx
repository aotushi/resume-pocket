import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 工作区类页面（我的简历、游客空间、账户设置、管理后台）共用的页头：
 * 标题字号、说明间距与右侧操作区统一在这里，页头下方内容统一从 mt-8 开始。
 */
export function PageHeader({ title, description, badge, actions, className }: { title: string; description: string; badge?: ReactNode; actions?: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden", className)}>
    <div>
      <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-[28px]">{title}{badge}</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">{description}</p>
    </div>
    {actions}
  </div>;
}
