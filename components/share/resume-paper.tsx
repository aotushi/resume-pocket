import type { ResumeContent } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

/**
 * 用 HTML 绘制的虚构 A4 简历（首页示意、/s/demo 示例页）。
 * 所有尺寸用 cqw（相对纸张宽度），因此放进任意宽度的容器都能等比缩放、打印也不变形。
 */
export function ResumePaper({ resume, page, className }: { resume: ResumeContent; page: 1 | 2; className?: string }) {
  return <div className={cn("@container w-full", className)}>
    <article className="aspect-[210/297] w-full overflow-hidden bg-white px-[8cqw] py-[7cqw] text-[2.05cqw] leading-[1.65] text-[#1f2b3a] shadow-[0_1px_2px_rgb(24_40_60/.08),0_8px_24px_rgb(24_40_60/.08)] print:shadow-none" aria-label={`示例简历第 ${page} 页`}>
      {page === 1 ? <>
        <header className="border-b-[0.35cqw] border-[#234f86] pb-[3cqw]">
          <h3 className="text-[5.4cqw] leading-tight font-bold tracking-wide">{resume.name}</h3>
          <p className="mt-[1cqw] text-[2.4cqw] font-medium text-[#234f86]">{resume.role}</p>
          <p className="mt-[1.2cqw] text-[#455468]">{resume.contact.join("  ·  ")}</p>
        </header>
        <Section title="个人简介"><p>{resume.summary}</p></Section>
        <Section title="工作经历">
          {resume.experience.map((item) => <div key={item.company} className="mb-[2.4cqw]">
            <div className="flex justify-between font-semibold"><span>{item.company} · {item.title}</span><span className="font-normal text-[#455468]">{item.period}</span></div>
            <ul className="mt-[0.8cqw] list-disc space-y-[0.4cqw] pl-[3cqw]">{item.points.map((point) => <li key={point}>{point}</li>)}</ul>
          </div>)}
        </Section>
      </> : <>
        <Section title="项目经历" first>
          {resume.projects.map((item) => <div key={item.name} className="mb-[2.4cqw]">
            <div className="flex justify-between font-semibold"><span>{item.name}</span><span className="font-normal text-[#455468]">{item.period}</span></div>
            <ul className="mt-[0.8cqw] list-disc space-y-[0.4cqw] pl-[3cqw]">{item.points.map((point) => <li key={point}>{point}</li>)}</ul>
          </div>)}
        </Section>
        <Section title="教育背景">
          {resume.education.map((item) => <div key={item.school} className="flex justify-between"><span className="font-semibold">{item.school} · <span className="font-normal">{item.degree}</span></span><span className="text-[#455468]">{item.period}</span></div>)}
        </Section>
        <Section title="技能">
          <div className="flex flex-wrap gap-[1.2cqw]">{resume.skills.map((skill) => <span key={skill} className="rounded-[0.6cqw] bg-[#eef3f9] px-[1.6cqw] py-[0.5cqw] text-[#1b3f6c]">{skill}</span>)}</div>
        </Section>
      </>}
    </article>
  </div>;
}

function Section({ title, first, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return <section className={first ? "" : "mt-[4cqw]"}>
    <h4 className="mb-[1.6cqw] text-[2.6cqw] font-bold tracking-wider text-[#234f86]">{title}</h4>
    {children}
  </section>;
}
