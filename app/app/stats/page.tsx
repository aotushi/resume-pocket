import type { Metadata } from "next";
import { StatisticsDashboard } from "@/components/workspace/statistics-dashboard";

export const metadata: Metadata = { title: "数据统计 | 简历口袋" };

export default function StatisticsPage() { return <StatisticsDashboard />; }
