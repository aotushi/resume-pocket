import { Skeleton } from "@/components/ui/skeleton";

/** 点开分享页时立即显示的占位，结构与分享页一致：工具栏 + 个人信息 + 简历纸面 */
export default function Loading() {
  return <div className="min-h-dvh bg-muted/40" role="status" aria-label="正在加载">
    <div className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
    <div className="mx-auto max-w-5xl space-y-2 px-4 py-5 sm:px-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-64 max-w-full" />
    </div>
    <div className="mx-auto max-w-[794px] px-4 pb-10">
      <Skeleton className="aspect-[210/297] w-full rounded-sm" />
    </div>
  </div>;
}
