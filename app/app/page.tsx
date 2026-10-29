import type { Metadata } from "next";
import { ResumeWorkspace } from "@/components/workspace/resume-workspace";

export const metadata: Metadata = { title: "我的简历 | 简历口袋" };

export default function ResumesPage() {
  return <ResumeWorkspace />;
}
