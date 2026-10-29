import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getCurrentUser } from "../lib/auth";

export const metadata: Metadata = { title: "隐私说明 | 简历口袋" };
export const dynamic = "force-dynamic";

const ISSUES = "https://github.com/aotushi/resume-pocket/issues";

export default async function PrivacyPage() {
  const signedIn = Boolean(await getCurrentUser());
  return <LegalPage
    signedIn={signedIn}
    title="隐私说明"
    intro="简历包含大量个人信息。这里用直白的话说明我们保存什么、谁能看到，以及你如何停止分享。"
    updatedAt="2026 年 10 月"
    sections={[
      { title: "我们保存什么", body: <ul>
        <li><strong>账户信息</strong>：注册邮箱、昵称，以及经过加密处理的密码（我们无法看到明文）。</li>
        <li><strong>简历文件</strong>：你上传的 PDF 原文件，以及文件名、大小、上传时间等基本信息。</li>
        <li><strong>登录状态</strong>：用于保持登录的会话 Cookie，不用于广告或跨站追踪。</li>
      </ul> },
      { title: "谁能看到你的简历", body: <>
        <p>简历默认保存在你的个人空间，只有登录后的你本人可以查看与管理。</p>
        <p>当你创建分享链接后，<strong>持有有效链接的任何人</strong>都可以打开、打印和下载对应简历；链接被转发后，持有者在有效期内同样可以查看。我们无法凭匿名链接识别访问者身份。</p>
      </> },
      { title: "如何停止分享", body: <ul>
        <li>链接到期后自动失效，无法再打开。</li>
        <li>你可以随时手动失活任意链接，其他链接不受影响。</li>
        <li>删除简历文件会使它的所有分享链接同时失效。</li>
      </ul> },
      { title: "访问统计", body: <p>为了让你了解分享效果、让我们改进服务，我们只记录汇总的访问次数，不记录简历内容、完整分享链接、密码或你给投递对象写的备注。</p> },
      { title: "数据删除", body: <p>你可以在工作区随时删除自己上传的简历。账户注销功能尚在完善中；如需注销账户并清理全部数据，请通过下方联系方式提出。</p> },
      { title: "联系我们", body: <p>对隐私有任何疑问，欢迎在 <a className="text-primary underline underline-offset-4" href={ISSUES} target="_blank" rel="noopener noreferrer">GitHub Issues</a> 反馈。请不要在公开反馈中填写简历内容或账户密码。</p> },
    ]}
  />;
}
