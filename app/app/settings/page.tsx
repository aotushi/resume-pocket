import type { Metadata } from "next";
import { AccountSettings } from "@/components/workspace/account-settings";
import { getCurrentUser } from "../../lib/auth";

export const metadata: Metadata = { title: "账户设置 | 简历口袋" };

export default async function SettingsPage() {
  // layout 已保证登录
  const user = (await getCurrentUser())!;
  return <AccountSettings user={{ name: user.name, email: user.email, createdAt: user.createdAt.toISOString() }} />;
}
