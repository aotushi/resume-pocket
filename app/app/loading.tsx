import { Skeleton } from "@/components/ui/skeleton";

/** 工作区页面切换时立即显示的占位，顶部导航保持不动 */
export default function Loading() {
  return <div className="space-y-6" role="status" aria-label="正在加载">
    <div className="space-y-2">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  </div>;
}
