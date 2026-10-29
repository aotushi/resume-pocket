import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getCurrentUser, isAdmin } from "../../lib/auth";

export const metadata: Metadata = { title: "管理后台 | 简历口袋" };

export default async function AdminPage() {
  // 非管理员一律 404，不暴露后台存在
  if (!isAdmin(await getCurrentUser())) notFound();
  return <AdminDashboard />;
}
