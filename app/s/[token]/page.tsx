import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareViewer } from "@/components/share/share-viewer";
import { demoResume, demoShare } from "@/lib/demo-data";

// 分享页不进搜索引擎、不向外站泄露来源地址，社交卡片不带简历信息
export const metadata: Metadata = {
  title: "简历预览 | 简历口袋",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  // 分享后端尚未实现，目前只有虚构示例；其他标识统一按「不存在或已失效」处理
  if (token !== demoShare.token) notFound();
  return <ShareViewer share={demoShare} resume={demoResume} demo />;
}
