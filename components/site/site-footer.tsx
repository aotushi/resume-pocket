import { Brand } from "./brand";

export function SiteFooter() {
  return <footer className="border-t bg-card">
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <Brand />
        <p className="text-sm text-muted-foreground">简历放网上，发个链接就能投。</p>
      </div>
      <nav aria-label="页脚导航" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <a className="hover:text-foreground" href="/privacy">隐私说明</a>
        <a className="hover:text-foreground" href="/terms">服务说明</a>
        <a className="hover:text-foreground" href="https://github.com/aotushi/resume-pocket/issues" target="_blank" rel="noopener noreferrer">问题反馈</a>
        <span>© {new Date().getFullYear()} 简历口袋</span>
      </nav>
    </div>
  </footer>;
}
