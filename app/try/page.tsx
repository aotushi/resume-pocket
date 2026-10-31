import type { Metadata } from "next";
import { AuthDialogProvider } from "@/components/auth/auth-dialog";
import { GuestSpace } from "@/components/guest/guest-space";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

// 页面不读取登录状态（已登录跳转在浏览器里做），整页静态，可提前加载并缓存
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "免注册上传 | 简历口袋",
  robots: { index: false, follow: false },
  // 管理链接的凭证在 # 之后，本就不会外发；这里再禁止 Referer 作为双保险
  referrer: "no-referrer",
};

/** 游客空间：已登录用户由 GuestSpace 跳转到自己的工作区 */
export default function TryPage() {
  return <AuthDialogProvider>
    <SiteHeader />
    <main id="main" className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-5 py-8 sm:px-8 lg:py-10 print:max-w-none print:p-0">
      <GuestSpace />
    </main>
    <SiteFooter />
  </AuthDialogProvider>;
}
