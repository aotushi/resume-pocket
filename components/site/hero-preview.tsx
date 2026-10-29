import { ArrowDownToLine, Clock3, Link2, MapPin, Printer } from "lucide-react";
import { ResumePaper } from "@/components/share/resume-paper";
import { demoResume, demoShare } from "@/lib/demo-data";

/** 首屏右侧：虚构分享页的缩略示意，帮助访客一眼看懂「招聘方会看到什么」 */
export function HeroPreview() {
  const { profile } = demoShare;
  return <div className="relative" aria-label="分享页示意（虚构内容）">
    {/* 背后的「创建链接」卡片，暗示求职者侧的操作 */}
    <div className="absolute -bottom-6 -left-4 z-10 hidden w-56 rounded-xl border bg-card p-3.5 shadow-lg sm:block lg:-left-10" aria-hidden>
      <div className="flex items-center gap-2 text-xs font-medium"><Link2 className="size-3.5 text-primary" />已为「示例公司 A」创建链接</div>
      <div className="mt-2.5 flex gap-1.5">
        {["1 天", "7 天", "永久"].map((label, index) => <span key={label} className={index === 0 ? "rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground" : "rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"}>{label}</span>)}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock3 className="size-3" />24 小时后自动失效</div>
    </div>

    <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-20px_rgb(24_40_60/.25)]">
      <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-[#d9dee5]" /><span className="size-2.5 rounded-full bg-[#d9dee5]" /><span className="size-2.5 rounded-full bg-[#d9dee5]" />
        <span className="ml-3 truncate rounded-md bg-card px-3 py-1 text-[11px] text-muted-foreground">resume-pocket/s/••••••</span>
      </div>
      <div className="border-b px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{profile.name}</p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">{profile.role}<span className="inline-flex items-center gap-0.5"><MapPin className="size-3" />{profile.location}</span></p>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            <span className="grid size-8 place-items-center rounded-md border text-muted-foreground"><Printer className="size-3.5" /></span>
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"><ArrowDownToLine className="size-3.5" /></span>
          </div>
        </div>
        <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-xs leading-relaxed text-secondary-foreground">{demoShare.note}</p>
      </div>
      <div className="h-[300px] overflow-hidden bg-[#e9edf2] px-8 pt-6 sm:h-[340px] sm:px-12">
        <ResumePaper resume={demoResume} page={1} />
      </div>
    </div>
  </div>;
}
