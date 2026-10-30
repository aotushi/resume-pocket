import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 工作区等动态页面切换后 5 分钟内再次进入直接用浏览器里的结果；登录状态与分享有效性另有接口实时校验
  experimental: { staleTimes: { dynamic: 300 } },
};

export default nextConfig;
