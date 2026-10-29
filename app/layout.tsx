import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "简历口袋 | 简历放网上，发个链接就能投",
  description: "上传简历，为不同公司或联系人创建独立链接并选择有效期。招聘方无需注册即可查看、打印与下载。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN">
    <body>
      {children}
      <Toaster position="top-center" richColors />
    </body>
  </html>;
}
