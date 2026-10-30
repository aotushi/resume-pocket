/**
 * 分享页访问统计的判定规则（纯函数，便于测试）。
 *
 * 计数只认页面在浏览器里真正运行后发回的一次上报：微信、QQ 等生成链接卡片时的抓取不执行脚本，天然不计；
 * 另外排除自动化工具的请求、所有者本人的访问，以及同一访客 30 分钟内的重复打开（刷新、切回页面）。
 */

/** 同一访客在这段时间内重复打开只算一次 */
export const REPEAT_WINDOW_MS = 30 * 60 * 1000;

/** 所有者查看明细时最多返回的条数 */
export const VIEW_DETAIL_LIMIT = 100;

const BOT_PATTERN = /bot|spider|crawl|slurp|preview|facebookexternalhit|whatsapp|headless|phantom|puppeteer|playwright|selenium|curl|wget|python|httpclient|okhttp|go-http|java\/|axios|node-fetch/i;

export function isAutomatedAgent(userAgent: string) {
  return !userAgent.trim() || BOT_PATTERN.test(userAgent);
}

/** 粗略识别设备与浏览器，只用于给所有者展示，不保存完整 User-Agent */
export function describeAgent(userAgent: string) {
  const ua = userAgent;
  const device = /ipad|tablet/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))
    ? "平板"
    : /mobi|iphone|android/i.test(ua) ? "手机" : "电脑";
  const browser = /micromessenger/i.test(ua) ? (/wxwork/i.test(ua) ? "企业微信" : "微信")
    : /dingtalk/i.test(ua) ? "钉钉"
    : /lark|feishu/i.test(ua) ? "飞书"
    : /\bqq\//i.test(ua) ? "QQ"
    : /mqqbrowser|qqbrowser/i.test(ua) ? "QQ 浏览器"
    : /ucbrowser|ucweb/i.test(ua) ? "UC 浏览器"
    : /quark/i.test(ua) ? "夸克"
    : /baiduboxapp|baidubrowser/i.test(ua) ? "百度"
    : /huaweibrowser/i.test(ua) ? "华为浏览器"
    : /miuibrowser|xiaomi\/miuibrowser/i.test(ua) ? "小米浏览器"
    : /heytapbrowser|oppobrowser/i.test(ua) ? "OPPO 浏览器"
    : /vivobrowser/i.test(ua) ? "vivo 浏览器"
    : /edg(e|a|ios)?\//i.test(ua) ? "Edge"
    : /firefox|fxios/i.test(ua) ? "Firefox"
    : /chrome|crios/i.test(ua) ? "Chrome"
    : /safari/i.test(ua) ? "Safari"
    : "其他浏览器";
  return { device, browser };
}

/** 访客标识：链接、IP 与 User-Agent 加密钥后的摘要，只用于去重和估算人数，无法还原出 IP */
export async function visitorHash(secret: string, linkId: string, ip: string, userAgent: string) {
  const data = new TextEncoder().encode(`${secret}\n${linkId}\n${ip}\n${userAgent}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(digest.slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
