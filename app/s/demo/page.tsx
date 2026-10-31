import type { Metadata } from "next";
import { ShareViewer } from "@/components/share/share-viewer";
import { demoResume, demoShare } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "简历预览 | 简历口袋",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// 示例分享页内容固定，单独做成静态页：首页链接可整页提前加载，点开不再等服务器
export const dynamic = "force-static";

export default function DemoSharePage() {
  return <ShareViewer share={demoShare} resume={demoResume} demo />;
}
