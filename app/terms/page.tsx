import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { GUEST_FORMATS, MAX_SIZE_TEXT, USER_FORMATS, USER_FORMATS_DETAIL } from "../lib/format-copy";

// 页面不读取登录状态（顶栏按钮在浏览器里判断），整页静态，可提前加载并缓存
export const dynamic = "force-static";

export const metadata: Metadata = { title: "服务说明 | 简历口袋" };

const ISSUES = "https://github.com/aotushi/resume-pocket/issues";

export default function TermsPage() {
  return <LegalPage
    title="服务说明"
    intro="使用简历口袋即表示你了解并同意以下约定。我们尽量保持简短，只写与你相关的规则。"
    updatedAt="2026 年 10 月"
    sections={[
      { title: "服务内容", body: <p>简历口袋帮助你在线保存 {USER_FORMATS} 简历，并通过链接分享给招聘方。平台不会代你投递或联系任何公司，链接由你自行发送。</p> },
      { title: "账户", body: <ul>
        <li>请使用你本人可以访问的邮箱注册：登录和找回密码都通过发往该邮箱的验证码完成，邮箱不可用可能导致无法继续访问已保存的简历。</li>
        <li>请勿把验证码告诉他人；设置了密码的，请妥善保管。</li>
      </ul> },
      { title: "你上传的内容", body: <ul>
        <li>目前支持 {USER_FORMATS_DETAIL} 格式（游客空间仅支持 {GUEST_FORMATS}），单个文件不超过 {MAX_SIZE_TEXT}。Word 简历会转换为 PDF 用于在线预览。</li>
        <li>请只上传你有权使用、内容真实的简历，不得上传违法、侵权或含恶意代码的文件。</li>
        <li>简历内容的版权与责任归你本人所有，我们只为提供服务而保存和展示它。</li>
      </ul> },
      { title: "分享链接", body: <p>分享链接由你创建和管理。在有效期内，任何持有链接的人都可以查看、打印和下载简历；请只把链接发给你信任的对象，必要时及时停用。</p> },
      { title: "服务变更与中断", body: <p>本服务仍在持续开发，功能可能调整。我们会尽力保障数据安全与可用性，但无法保证服务永不中断，建议你在本地保留简历原文件。</p> },
      { title: "联系我们", body: <p>问题与建议请在 <a className="text-primary underline underline-offset-4" href={ISSUES} target="_blank" rel="noopener noreferrer">GitHub Issues</a> 反馈。</p> },
    ]}
  />;
}
