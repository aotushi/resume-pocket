import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareUnavailable } from "@/components/share/share-unavailable";
import { ShareViewer } from "@/components/share/share-viewer";
import { demoResume, demoShare } from "@/lib/demo-data";
import { parseProfile } from "../../lib/share-policy";
import { addShareView, resolveShare } from "../../lib/shares";

// 分享页不进搜索引擎、不向外站泄露来源地址，社交卡片不带简历信息
export const metadata: Metadata = {
  title: "简历预览 | 简历口袋",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  if (token === demoShare.token) return <ShareViewer share={demoShare} resume={demoResume} demo />;

  const share = await resolveShare(token);
  if (share.state === "inactive") return <ShareUnavailable state="inactive" />;
  if (share.state !== "active") notFound();

  // 只统计页面打开次数；文件请求（预览、打印、下载）不计
  await addShareView(share.link.id).catch((error) => console.error("Could not count share view", error));
  const { link, resume } = share;
  return <ShareViewer token={token} share={{
    token: "",
    profile: parseProfile(link.profile),
    note: link.note || undefined,
    fileName: resume.name,
    updatedAt: resume.uploadedAt,
  }} />;
}
