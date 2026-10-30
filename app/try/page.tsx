import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthDialogProvider } from "@/components/auth/auth-dialog";
import { GuestSpace } from "@/components/guest/guest-space";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getCurrentUser } from "../lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "免注册上传 | 简历口袋",
  robots: { index: false, follow: false },
  // 管理链接的凭证在 # 之后，本就不会外发；这里再禁止 Referer 作为双保险
  referrer: "no-referrer",
};

/** 游客空间：已登录用户直接去自己的工作区 */
export default async function TryPage() {
  if (await getCurrentUser()) redirect("/app");
  return <AuthDialogProvider>
    <SiteHeader />
    <main id="main" className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-5 py-8 sm:px-8 lg:py-10 print:max-w-none print:p-0">
      <GuestSpace />
    </main>
    <SiteFooter />
  </AuthDialogProvider>;
}
