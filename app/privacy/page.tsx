import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal-page";
import { USER_FORMATS } from "../lib/format-copy";

// 页面不读取登录状态（顶栏按钮在浏览器里判断），整页静态，可提前加载并缓存
export const dynamic = "force-static";

export const metadata: Metadata = { title: "隐私说明 | 简历口袋" };

const ISSUES = "https://github.com/aotushi/resume-pocket/issues";

export default function PrivacyPage() {
  return <LegalPage
    title="隐私说明"
    intro="简历包含大量个人信息。这里用直白的话说明我们保存什么、谁能看到，以及你如何停止分享。"
    updatedAt="2026 年 11 月 4 日"
    sections={[
      { title: "我们保存什么", body: <ul>
        <li><strong>账户信息</strong>：注册邮箱、昵称，以及经过加密处理的密码（我们无法看到明文）。登录或找回密码时，我们会向你的邮箱发送一次性验证码，验证码只保存摘要，10 分钟后失效。</li>
        <li><strong>简历文件</strong>：你上传的 {USER_FORMATS} 原文件、Word 转换生成的 PDF 预览版本，以及文件名、大小、上传时间等基本信息。更新 Word 时，为保障正在下载的文件完整，旧原件和未发布原件会保留至你删除这份简历或注销账户，分享页仅提供当前版本。</li>
        <li><strong>分享信息</strong>：你填写的公开信息卡、投递留言和私人备注，以及链接期限和状态。公开信息卡和投递留言展示给持有有效链接的人，私人备注仅创建者可见。</li>
        <li><strong>登录状态</strong>：用于保持登录的会话 Cookie，不用于广告或跨站追踪。</li>
      </ul> },
      { title: "谁能看到你的简历", body: <>
        <p>简历默认保存在你的个人空间，只有登录后的你本人可以查看与管理。</p>
        <p>当你创建分享链接后，<strong>持有有效链接的任何人</strong>都可以打开、打印和下载对应简历；链接被转发后，持有者在有效期内同样可以查看。我们无法凭匿名链接识别访问者身份。</p>
      </> },
      { title: "如何停止分享", body: <ul>
        <li>链接到期后自动失效，无法再打开。</li>
        <li>你可以随时手动停用任意链接，其他链接不受影响。</li>
        <li>删除简历文件会使它的所有分享链接同时失效。</li>
        <li>已打开的页面在前台且联网时每 30 秒检查一次，恢复网络或切回页面时也会检查；发现失效后移除简历，手动停用时提示 5 秒后返回首页。离线页面和已下载、打印或截图的副本无法远程收回。</li>
      </ul> },
      { title: "访问统计", body: <p>为了解分享效果，我们记录访问时间、大致地区（国家、省份和城市）以及设备和浏览器类型。访问明细仅向链接创建者展示，管理员仅能查看全站汇总。访问记录不保存 IP 地址或完整浏览器信息，只保留摘要用于合并同一访客 30 分钟内的重复访问；创建者本人和已识别的自动预览不计入。统计不包含简历内容、联系方式、分享标识或备注。删除链接、简历或账户时，相关访问记录一并删除。</p> },
      { title: "数据删除", body: <>
        <p>你可以在工作区随时删除简历，或前往 <Link className="text-primary underline underline-offset-4" href="/app/settings">账户设置</Link>，经邮箱确认后永久删除账户、全部简历版本、分享信息和访问记录，并退出所有设备。请提前下载需要保留的文件。</p>
        <p>游客简历上传 14 天后停止访问，系统每小时清理到期文件及其分享、访问记录。注销账户后只保留一个不含文件或联系方式的随机账户标识摘要，用于阻止注销前已开始的上传重新留下文件。</p>
      </> },
      { title: "联系我们", body: <p>一般问题可在 <a className="text-primary underline underline-offset-4" href={ISSUES} target="_blank" rel="noopener noreferrer">GitHub Issues</a> 反馈。该渠道完全公开，请勿填写邮箱、简历、分享链接、账户密码或其他个人信息。删除个人数据请使用账户设置中的自助功能。</p> },
    ]}
  />;
}
