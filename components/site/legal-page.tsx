import type { ReactNode } from "react";
import { AuthDialogProvider } from "@/components/auth/auth-dialog";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type Section = { title: string; body: ReactNode };

/** 隐私说明、服务说明共用的长文版式：左侧目录（大屏）+ 正文 */
export function LegalPage({ title, intro, updatedAt, sections, signedIn }: { title: string; intro: string; updatedAt: string; sections: Section[]; signedIn: boolean }) {
  return <AuthDialogProvider>
    <SiteHeader signedIn={signedIn} />
    <main id="main" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="max-w-3xl">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight text-balance sm:text-4xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{intro}</p>
        <p className="mt-3 text-sm text-muted-foreground">最后更新：{updatedAt}</p>
      </header>
      <div className="mt-10 grid gap-10 sm:mt-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="本页目录" className="hidden lg:block">
          <ol className="sticky top-24 space-y-1 border-l text-sm">
            {sections.map((section, index) => <li key={section.title}><a href={`#s${index + 1}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-muted-foreground hover:border-primary hover:text-foreground">{section.title}</a></li>)}
          </ol>
        </nav>
        <div className="max-w-3xl space-y-10">
          {sections.map((section, index) => <section key={section.title} id={`s${index + 1}`} aria-labelledby={`s${index + 1}-title`}>
            <h2 id={`s${index + 1}-title`} className="text-xl font-semibold">{index + 1}. {section.title}</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-7 text-muted-foreground [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{section.body}</div>
          </section>)}
        </div>
      </div>
    </main>
    <SiteFooter />
  </AuthDialogProvider>;
}
