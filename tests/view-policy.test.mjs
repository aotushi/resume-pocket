import test from "node:test";
import assert from "node:assert/strict";
import { describeAgent, isAutomatedAgent, visitorHash } from "../app/lib/view-policy.ts";

const wechat = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800322d) NetType/WIFI Language/zh_CN";
const desktopChrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const ipad = "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

test("automated clients and link previewers are excluded from view counts", () => {
  for (const ua of ["", "curl/8.4.0", "Mozilla/5.0 (compatible; Googlebot/2.1)", "facebookexternalhit/1.1", "TelegramBot (like TwitterBot)", "Mozilla/5.0 HeadlessChrome/130.0.0.0", "python-requests/2.31"]) {
    assert.equal(isAutomatedAgent(ua), true, ua);
  }
  for (const ua of [wechat, desktopChrome, ipad]) assert.equal(isAutomatedAgent(ua), false, ua);
});

test("device and browser are summarized for the owner", () => {
  assert.deepEqual(describeAgent(wechat), { device: "手机", browser: "微信" });
  assert.deepEqual(describeAgent(desktopChrome), { device: "电脑", browser: "Chrome" });
  assert.deepEqual(describeAgent(ipad), { device: "平板", browser: "Safari" });
});

test("visitor hash is stable per link and does not contain the IP", async () => {
  const a = await visitorHash("secret", "link-1", "203.0.113.9", wechat);
  assert.match(a, /^[0-9a-f]{24}$/);
  assert.equal(a, await visitorHash("secret", "link-1", "203.0.113.9", wechat));
  assert.notEqual(a, await visitorHash("secret", "link-2", "203.0.113.9", wechat));
  assert.ok(!a.includes("203"));
});
