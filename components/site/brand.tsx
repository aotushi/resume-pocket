import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/** 产品标识：首页、工作区、分享页共用 */
export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-md font-semibold tracking-wide", className)} aria-label="简历口袋首页">
    <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><FileText className="size-[18px]" strokeWidth={2} /></span>
    <span className="text-base">简历口袋</span>
  </Link>;
}
