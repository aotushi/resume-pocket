import { ArrowRight, Briefcase, CalendarClock, Check, Eye, FileUp, GraduationCap, Images, Link2, Minus, MonitorSmartphone, PenLine, Power, Printer, Send, ShieldCheck, UserRoundCheck, UserRoundSearch, UserX, X, Zap } from "lucide-react";
import { AuthButton, AuthDialogProvider } from "@/components/auth/auth-dialog";
import { HeroPreview } from "@/components/site/hero-preview";
import { LinkStateDemo } from "@/components/site/link-state-demo";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "./lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

// 首页统一的版式尺度（8pt 网格，内距 < 外距）：区块已有分隔线与交替底色，留白不必再加大
const container = "mx-auto max-w-6xl px-5 sm:px-8";
const sectionY = "py-12 sm:py-16";
const contentTop = "mt-8 sm:mt-10";
const card = "landing-surface rounded-xl border p-5";
const cardGrid = "grid gap-4";

const steps = [
  { icon: FileUp, title: "上传简历", text: "把准备好的 PDF 或 Word 简历放进自己的空间，随时预览、打印与下载。" },
  { icon: Link2, title: "创建链接", text: "为每家公司或联系人单独创建链接，选择 1 天、7 天、自定义或永久有效。" },
  { icon: Send, title: "发给对方", text: "复制链接，通过你习惯的方式发送。对方无需注册，打开即可查看。" },
];

const features = [
  { icon: Eye, title: "打开就能看", text: "PDF 原样显示，Word 自动转成可在线看的版本；电脑、手机都看得清，也能直接打印或下载。" },
  { icon: CalendarClock, title: "一家公司一条链接", text: "每条链接可以单独写一句留言、决定是否显示联系方式，彼此互不影响。" },
  { icon: Power, title: "发出去也能收回", text: "到期自动失效，也能随时手动关掉、再打开；换了新版简历，发出去的链接自动显示新版。" },
];

const scenarios = [
  { icon: GraduationCap, title: "校招与海投", text: "同时投递多家公司时，每家一条链接，哪家看过、哪条该收回都一目了然。" },
  { icon: Briefcase, title: "面试前补发", text: "面试官临时要简历，发一条 1 天有效的链接，不用翻找附件或重新发邮件。" },
  { icon: UserRoundSearch, title: "交给猎头", text: "长期合作可以用永久链接；更新简历后，对方再打开看到的就是新版。" },
  { icon: MonitorSmartphone, title: "换设备打印", text: "在公司、打印店或手机上打开自己的空间，直接预览、打印或下载原文件。" },
];

type Mark = "yes" | "no" | "partial";

// 对比只列本产品能兑现的能力；纸质简历、邮件附件、网盘链接按常见用法概括，不针对具体厂商
const compareColumns = ["简历口袋", "纸质简历", "邮件附件", "网盘链接"];
const comparison: { label: string; values: [Mark, Mark, Mark, Mark] }[] = [
  { label: "随时送达，无需打印或递送", values: ["yes", "no", "yes", "yes"] },
  { label: "改一个字不用重新打印、重新发送", values: ["yes", "no", "no", "partial"] },
  { label: "发出后可以收回", values: ["yes", "no", "no", "partial"] },
  { label: "按对象设置有效期", values: ["yes", "no", "no", "partial"] },
  { label: "对方无需注册或下载 App", values: ["yes", "yes", "yes", "partial"] },
  { label: "手机上直接阅读多页简历", values: ["yes", "no", "partial", "partial"] },
  { label: "每份单独附一段投递留言", values: ["yes", "partial", "yes", "no"] },
];

// 游客与注册用户的权限边界见需求 6.3 节；两张卡片逐行对齐，便于横向比较
const plans = [
  {
    key: "guest", icon: Zap, title: "游客", subtitle: "不用账号，打开就能用",
    rows: ["PDF", "1 份，14 天后自动删除", "1 天、2 天、7 天", "最多 3 条", "支持", "每条链接的访问次数", "凭管理链接"],
  },
  {
    key: "member", icon: UserRoundCheck, title: "注册用户", subtitle: "免费注册，长期使用",
    rows: ["PDF、Word", "多份，长期保存", "另可自定义日期或永久", "更多", "支持", "完整的数据统计", "登录即可"],
  },
] as const;
const planLabels = ["文件格式", "保存简历", "链接有效期", "同时有效的链接", "投递留言与随时失活", "访问统计", "换设备管理"];

const roadmap = [
  { icon: Images, title: "更多文档与图片格式", text: "在 PDF 和 Word 之外，陆续支持更多文档格式及 JPG、PNG 等图片简历，同样可以在线预览、打印和下载。" },
  { icon: PenLine, title: "在线制作简历", text: "在网站上直接编辑内容、选择模板并导出 PDF，范围仍在讨论中。" },
];

const faqs = [
  { q: "支持什么文件？", a: "支持 PDF 和 Word（DOCX、DOC），单个文件不超过 10 MB。PDF 按原排版呈现；Word 会转换后在线预览，字体或分页可能与原文件略有差异，分享前请先检查预览，下载时提供原文件。后续还会支持更多文档与图片格式。" },
  { q: "对方需要注册账号吗？", a: "不需要。持有有效链接的人可以直接在浏览器中查看简历，默认可以打印和下载。" },
  { q: "链接会失效吗？", a: "创建时可选择 1 天（默认）、2 天、7 天、自定义日期或永久有效。到期后链接无法再打开；你也可以随时手动失活，之后可以重新启用。" },
  { q: "链接被转发了怎么办？", a: "链接在有效期内，任何拿到它的人都可能打开。如果不希望继续被查看，可以立即失活这条链接。" },
  { q: "更新简历后，之前发出的链接会变吗？", a: "为同一份简历上传新版后，它的有效链接会自动展示最新版本，有效期与状态保持不变。新上传另一份简历不会影响旧链接。" },
  { q: "必须公开手机号和邮箱吗？", a: "不必。分享页上的公开信息卡和投递留言都是可选的，不填写时招聘方只看到简历本身。私人备注（例如「投给 A 公司产品岗」）只有你自己能看到。" },
  { q: "删除简历后会怎样？", a: "删除后，这份简历的所有分享链接会一起失效，对方无法再查看或下载。" },
  { q: "可以不注册直接用吗？", a: "可以。选择「无需注册，直接上传」，即可上传 1 份 PDF 简历，并同时保留最多 3 条 1 天、2 天或 7 天有效的链接。游客简历上传 14 天后自动删除；请保存好页面上的管理链接，换设备或清除浏览器数据后要凭它继续管理。需要上传 Word、长期保存或永久链接时，注册即可。" },
  { q: "能分享到 X、Facebook 等社交平台吗？", a: "创建链接后可以一键发送到 Telegram、WhatsApp、邮件或手机上的其他应用，适合发给具体的招聘方。我们不提供发布到 X、Facebook 等公开平台的按钮：简历包含个人信息，公开发帖后无法控制谁会看到，也难以真正收回。" },
  { q: "忘记密码可以找回吗？", a: "目前暂不支持邮箱验证和密码找回，请妥善保管密码。该能力会在后续版本中提供。" },
];

export default async function Home() {
  const user = await getCurrentUser();
  const signedIn = Boolean(user);

  return <AuthDialogProvider>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:shadow">跳到正文</a>
    <SiteHeader signedIn={signedIn} />

    {/* landing：区块分隔线与交替底色见 globals.css */}
    <main id="main" className="landing">
      {/* 首屏 */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_70%_20%,#dfe8f4_0%,transparent_70%)]" aria-hidden />
        <div className={cn(container, "grid items-center gap-10 pt-10 pb-12 sm:pt-14 sm:pb-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12")}>
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" />链接有效期由你决定</p>
            <h1 className="mt-6 text-[34px] leading-[1.25] font-bold tracking-tight text-balance sm:text-5xl sm:leading-[1.2]">把简历放在线上，<br />随时分享给招聘方。</h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">上传 PDF 或 Word 简历，为不同公司或联系人创建独立链接，并选择有效期。招聘方无需注册，打开即可查看、打印和下载。</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {signedIn
                ? <Button asChild size="lg" className="h-12 px-7 text-[15px]"><a href="/app">进入工作区<ArrowRight /></a></Button>
                : <AuthButton mode="signup" size="lg" className="h-12 px-7 text-[15px]">免费开始使用<ArrowRight /></AuthButton>}
              <Button asChild variant="outline" size="lg" className="h-12 bg-card px-7 text-[15px]">
                {signedIn ? <Link href="/s/demo">查看示例分享页</Link> : <Link href="/try">无需注册，直接上传</Link>}
              </Button>
            </div>
            {!signedIn && <p className="mt-4 text-sm text-muted-foreground">先看看效果？<Link href="/s/demo" className="font-medium text-primary hover:underline">打开示例分享页</Link></p>}
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5"><UserX className="size-4 text-primary" />对方无需注册</li>
              <li className="flex items-center gap-1.5"><Power className="size-4 text-primary" />链接可随时失活</li>
              <li className="flex items-center gap-1.5"><Printer className="size-4 text-primary" />支持打印与下载</li>
            </ul>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* 使用方式 */}
      <section id="how" className={sectionY}>
        <div className={container}>
          <SectionHeading eyebrow="使用方式" title="三步，完成一次投递" text="链接由你自己发出，我们不会替你联系招聘方。" />
          <ol className={cn(contentTop, cardGrid, "md:grid-cols-3")}>
            {steps.map((step, index) => <li key={step.title} className={card}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">{index + 1}</span>
                <h3 className="text-base font-semibold sm:text-lg">{step.title}</h3>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{step.text}</p>
            </li>)}
          </ol>
        </div>
      </section>

      {/* 按对象分享演示 */}
      <section id="demo" className={sectionY}>
        <div className={container}>
          <SectionHeading eyebrow="看看效果" title="一份简历，给每家公司一条链接" text="点击任意一条链接，查看招聘方在手机上打开时看到的样子。以下均为虚构示例。" />
          <div className={contentTop}><LinkStateDemo /></div>
        </div>
      </section>

      {/* 产品功能 */}
      <section id="features" className={sectionY}>
        <div className={container}>
          <SectionHeading eyebrow="产品功能" title="专门为投简历做的" text="不是网盘，也不是模板库，只做一件事：让招聘方顺利看到你的简历。" />
          <div className={cn(contentTop, cardGrid, "md:grid-cols-3")}>
            {features.map((feature) => <div key={feature.title} className={card}>
              <CardText icon={feature.icon} title={feature.title} text={feature.text} />
            </div>)}
          </div>

          {/* 隐私边界：只说能兑现的 */}
          <div className={cn(card, "mt-4 grid gap-5 sm:p-6 md:grid-cols-[1fr_1.4fr] md:items-center md:gap-8")}>
            <div>
              <CardText icon={ShieldCheck} title="谁能看到，说清楚" text="我们不说「绝对安全」，只把每条链接谁能看到讲明白，并让你随时收回。" />
            </div>
            <ul className="grid gap-3 text-[15px] sm:grid-cols-2">
              {["简历保存在你的个人空间，登录后只有你能管理", "持有有效链接的人可以打开，默认可打印和下载", "链接被转发后，持有者在有效期内仍可能查看", "到期或手动失活后，链接立即无法继续打开"].map((item) => <li key={item} className="flex gap-2.5 rounded-lg bg-muted/60 px-4 py-3 leading-relaxed"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* 适用场景 */}
      <section id="scenarios" className={sectionY}>
        <div className={container}>
          <SectionHeading eyebrow="适用场景" title="求职路上，这些时候用得上" text="我们不替你投递，只让发出去的每份简历都管得住。" />
          <div className={cn(contentTop, cardGrid, "sm:grid-cols-2 lg:grid-cols-4")}>
            {scenarios.map((item) => <div key={item.title} className={card}>
              <CardText icon={item.icon} title={item.title} text={item.text} />
            </div>)}
          </div>
        </div>
      </section>

      {/* 与常见方式对比 */}
      <section id="compare" className={sectionY}>
        <div className={container}>
          <SectionHeading eyebrow="为什么放在线上" title="和纸质简历、邮件附件、网盘链接比" text="纸质简历要打印、递送，改一个字就得重印；附件一旦发出就收不回；网盘链接常常要求对方登录或下载 App。" />
          <div className={cn(contentTop, "mx-auto max-w-4xl")}>
            {/* relative：让单元格里 sr-only 的绝对定位文字留在表格容器内，否则会撑宽手机页面 */}
            <div className="landing-surface relative overflow-hidden rounded-xl border">
              <table className="w-full table-fixed text-left text-sm sm:text-[15px]">
                <colgroup><col />{compareColumns.map((name) => <col key={name} className="w-10 sm:w-20 lg:w-28" />)}</colgroup>
                <thead className="border-b bg-muted/50 text-xs sm:text-sm">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-medium text-muted-foreground sm:px-5">能力</th>
                    {compareColumns.map((name, index) => <th key={name} scope="col" className={cn("px-1 py-3 text-center leading-tight sm:px-3", index === 0 ? "bg-secondary font-semibold text-primary" : "font-medium text-muted-foreground")}>
                      {name.slice(0, 2)}<br className="sm:hidden" />{name.slice(2)}
                    </th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {comparison.map((row) => <tr key={row.label}>
                    <th scope="row" className="px-3 py-3 font-normal sm:px-5">{row.label}</th>
                    {row.values.map((value, index) => <td key={index} className={cn("px-1 py-3 text-center sm:px-3", index === 0 && "bg-secondary/50")}><CompareMark value={value} /></td>)}
                  </tr>)}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">「—」表示部分支持，取决于具体服务或设置。</p>
            <div className={cn(card, "mt-4 flex gap-3")}>
              <Printer className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-[15px] leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">面试现场仍要纸质版？</span>不冲突。你可以在自己的空间里随时打印最新版本，招聘方也能在分享页直接打印，不必提前准备一沓、改了又重印。</p>
            </div>
          </div>
        </div>
      </section>

      {/* 免注册使用：两张方案卡逐行对齐，代替原来的三列表格 */}
      {!signedIn && <section id="guest" className={sectionY}>
        <div className={container}>
          <SectionHeading eyebrow="免注册使用" title="急着投一份？不注册也行" text="上传、预览、创建有期限的链接、随时失活，这些都不需要账号。游客空间有数量和时间限制，需要长期使用时再注册。" />
          <div className={cn(contentTop, cardGrid, "mx-auto max-w-4xl md:grid-cols-2")}>
            {plans.map((plan) => {
              const member = plan.key === "member";
              return <div key={plan.key} className={cn(card, "relative flex flex-col sm:p-6", member && "border-primary/50 ring-1 ring-primary/50")}>
                {member && <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">长期使用推荐</span>}
                <div className="flex items-center gap-3">
                  <IconTile icon={plan.icon} />
                  <div>
                    <h3 className="text-lg font-semibold">{plan.title}</h3>
                    <p className="text-sm text-muted-foreground">{plan.subtitle}</p>
                  </div>
                </div>
                <dl className="mt-5 flex-1 divide-y border-y">
                  {plan.rows.map((value, index) => <div key={planLabels[index]} className="flex items-baseline justify-between gap-4 py-3 text-[15px]">
                    <dt className="shrink-0 text-muted-foreground">{planLabels[index]}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>)}
                </dl>
                <div className="mt-5">
                  {member
                    ? <AuthButton mode="signup" size="lg" variant="outline" className="h-11 w-full text-[15px]">免费注册</AuthButton>
                    : <Button asChild size="lg" className="h-11 w-full text-[15px]"><Link href="/try">无需注册，直接上传<ArrowRight /></Link></Button>}
                </div>
              </div>;
            })}
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">游客没有账号，请保存好上传后显示的管理链接。</p>
        </div>
      </section>}

      {/* 规划中：未上线功能明确标注，不当作现有能力宣传 */}
      <section id="roadmap" className={sectionY}>
        <div className={container}>
          <SectionHeading eyebrow="规划中" title="接下来会做的事" text="以下功能尚未上线，具体范围与时间以后续公告为准。" />
          <div className={cn(contentTop, cardGrid, "mx-auto max-w-4xl md:grid-cols-2")}>
            {roadmap.map((item) => <div key={item.title} className={cn(card, "border-dashed")}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><item.icon className="size-[18px]" /></span>
                <h3 className="flex-1 text-base font-semibold sm:text-lg">{item.title}</h3>
                <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">规划中</span>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{item.text}</p>
            </div>)}
          </div>
        </div>
      </section>

      {/* 常见问题 */}
      <section id="faq" className={sectionY}>
        <div className={cn(container, "grid gap-6 lg:grid-cols-[1fr_1.6fr] lg:gap-16")}>
          <SectionHeading eyebrow="常见问题" title="你可能想知道" text="没找到答案？欢迎通过页脚的问题反馈联系我们。" align="left" />
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq) => <AccordionItem key={faq.q} value={faq.q}>
              <AccordionTrigger className="py-4 text-base hover:no-underline">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>)}
          </Accordion>
        </div>
      </section>

      {/* 收尾行动 */}
      <section className={sectionY}>
        <div className={container}>
          <div className="flex flex-col items-start gap-6 rounded-2xl bg-primary px-6 py-8 text-primary-foreground sm:px-10 sm:py-10 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">准备好下一次投递了吗？</h2>
              <p className="mt-3 text-primary-foreground/80">上传一份简历，几分钟内就能发出第一条链接。</p>
            </div>
            {signedIn
              ? <Button asChild size="lg" variant="secondary" className="h-12 px-7 text-[15px]"><a href="/app">进入工作区<ArrowRight /></a></Button>
              : <AuthButton mode="signup" size="lg" variant="secondary" className="h-12 px-7 text-[15px]">免费开始使用<ArrowRight /></AuthButton>}
          </div>
        </div>
      </section>
    </main>

    <SiteFooter />
  </AuthDialogProvider>;
}

function IconTile({ icon: Icon }: { icon: typeof Eye }) {
  return <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Icon className="size-[18px]" /></span>;
}

// 卡片标题与正文：图标与标题同一行，正文 mt-3；不再把图标单独叠在标题上方
function CardText({ icon, title, text }: { icon: typeof Eye; title: string; text: string }) {
  return <>
    <div className="flex items-center gap-3">
      <IconTile icon={icon} />
      <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
    </div>
    <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
  </>;
}

function CompareMark({ value }: { value: Mark }) {
  if (value === "yes") return <span className="inline-flex text-success"><Check className="size-4" /><span className="sr-only">支持</span></span>;
  if (value === "no") return <span className="inline-flex text-muted-foreground"><X className="size-4" /><span className="sr-only">不支持</span></span>;
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="size-4" /><span className="hidden sm:inline">部分</span><span className="sr-only sm:hidden">部分支持</span></span>;
}

function SectionHeading({ eyebrow, title, text, align = "center" }: { eyebrow: string; title: string; text: string; align?: "center" | "left" }) {
  return <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
    <p className="text-sm font-semibold text-primary">{eyebrow}</p>
    <h2 className="mt-2 text-[26px] leading-tight font-bold tracking-tight text-balance sm:text-[32px]">{title}</h2>
    <p className="mt-3 text-base leading-relaxed text-muted-foreground">{text}</p>
  </div>;
}
