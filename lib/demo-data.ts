/**
 * 虚构示例与后台 mock 数据。
 * 分享、统计、管理员接口尚未实现（见 docs/requirements.md），相关页面暂用这里的数据渲染 UI；
 * 所有姓名、公司、邮箱均为虚构，不得替换成真实用户信息。
 */

export type ShareProfile = { name?: string; role?: string; location?: string; email?: string; phone?: string };

export type DemoShare = {
  token: string;
  profile: ShareProfile;
  note?: string;
  fileName: string;
  updatedAt: string;
  /** 到期时间；永久有效或示例页为空 */
  expiresAt?: string | null;
};

export const demoShare: DemoShare = {
  token: "demo",
  profile: { name: "林晓", role: "高级产品经理", location: "上海", email: "linxiao@example.com" },
  note: "您好，我想应聘贵司的产品经理岗位，以下是我的简历，感谢查阅。",
  fileName: "林晓-产品经理.pdf",
  updatedAt: "2026-10-20T09:00:00.000Z",
};

export type ResumeContent = {
  name: string;
  role: string;
  contact: string[];
  summary: string;
  experience: { company: string; title: string; period: string; points: string[] }[];
  projects: { name: string; period: string; points: string[] }[];
  education: { school: string; degree: string; period: string }[];
  skills: string[];
};

export const demoResume: ResumeContent = {
  name: "林晓",
  role: "高级产品经理 · 6 年 B 端 SaaS 经验",
  contact: ["上海", "linxiao@example.com", "138-0000-0000"],
  summary: "专注企业协同与数据产品，主导过从 0 到 1 的产品搭建与规模化增长。擅长把复杂业务拆解成清晰的流程与指标，与设计、研发和销售团队紧密协作。",
  experience: [
    {
      company: "青禾科技（虚构）", title: "高级产品经理", period: "2022.03 — 至今",
      points: [
        "负责团队协作平台的审批与报表模块，服务 3,000+ 企业客户。",
        "重构审批配置流程，配置耗时由平均 25 分钟降至 8 分钟。",
        "建立需求分级与数据看板机制，版本延期率下降 40%。",
      ],
    },
    {
      company: "云帆数据（虚构）", title: "产品经理", period: "2019.07 — 2022.02",
      points: [
        "从 0 到 1 设计数据采集与可视化产品，首年签约 120 家客户。",
        "主导用户访谈与可用性测试 60+ 场，沉淀行业解决方案模板。",
      ],
    },
  ],
  projects: [
    {
      name: "智能报表助手", period: "2024.01 — 2024.09",
      points: ["定义自然语言生成报表的交互方案，周活跃使用率提升 35%。", "协调 4 个团队完成灰度发布与效果评估。"],
    },
    {
      name: "移动审批体验升级", period: "2023.03 — 2023.08",
      points: ["梳理 18 类审批场景，统一移动端表单规范。", "审批平均处理时长缩短 30%。"],
    },
  ],
  education: [{ school: "示例大学（虚构）", degree: "信息管理与信息系统 · 本科", period: "2015 — 2019" }],
  skills: ["需求分析", "数据分析 SQL", "原型设计 Figma", "用户研究", "项目管理", "英语 CET-6"],
};

/* ---------- 管理员后台 mock ---------- */

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastActiveAt: string;
  resumes: number;
  shares: number;
  status: "active" | "suspended";
};

export const adminSummary = {
  users: 128,
  newUsers7d: 14,
  resumes: 342,
  storageMb: 612,
  shares: { total: 506, active: 187, expired: 251, inactive: 68 },
  visits: { landing: 8_421, share: 2_964 },
  updatedAt: "2026-10-29T08:30:00.000Z",
};

export const adminVisitTrend = [
  { day: "10-23", landing: 1102, share: 368 },
  { day: "10-24", landing: 1240, share: 402 },
  { day: "10-25", landing: 980, share: 331 },
  { day: "10-26", landing: 1015, share: 389 },
  { day: "10-27", landing: 1386, share: 477 },
  { day: "10-28", landing: 1412, share: 512 },
  { day: "10-29", landing: 1286, share: 485 },
];

const names = ["张一鸣", "李思远", "王晓雨", "陈默", "刘佳宁", "赵子涵", "孙悦", "周启航", "吴可欣", "郑浩然", "冯若溪", "何嘉怡"];

export const adminUsers: AdminUser[] = names.map((name, index) => ({
  id: `u_${(index + 1).toString().padStart(3, "0")}`,
  name,
  email: `user${index + 1}@example.com`,
  createdAt: new Date(Date.UTC(2026, 8, 1 + index * 4)).toISOString(),
  lastActiveAt: new Date(Date.UTC(2026, 9, 29 - (index % 9), 10 - (index % 5))).toISOString(),
  resumes: (index * 7) % 5 + 1,
  shares: (index * 11) % 9,
  status: index === 4 || index === 9 ? "suspended" : "active",
}));
