import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "简历口袋 | 让好机会，随时看见你",
  description: "把简历妥帖收好，随时在线查看、打印与下载。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
