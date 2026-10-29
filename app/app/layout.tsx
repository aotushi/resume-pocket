import { redirect } from "next/navigation";
import { AppHeader } from "@/components/workspace/app-header";
import { getCurrentUser, isAdmin } from "../lib/auth";

export const dynamic = "force-dynamic";

/** 工作区外壳：未登录时回首页并自动弹出登录框，登录后回到 /app */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin&next=/app");
  return <div className="min-h-screen print:min-h-0">
    <AppHeader user={{ name: user.name, email: user.email }} admin={isAdmin(user)} />
    <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10 print:max-w-none print:p-0">{children}</main>
  </div>;
}
