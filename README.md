# 简历口袋

把 PDF 简历收在自己的空间里，需要时可以在电脑或手机上打开、打印、下载或删除。项目首先解决已有简历的保存和展示；在线制作和模板编辑留待后续实现。

## 当前功能

- 邮箱和密码注册、登录与退出；每个账号只能访问自己的文件。
- 上传 PDF，单个文件最大 10 MB；预览、打印以及原文件下载。
- 数据保存在 Cloudflare D1 和 R2，登录同一账号可跨设备访问。
- 暂不支持邮箱验证、密码找回、公开分享、Word 转换和在线制作。请妥善保管密码。

界面和产品方向参考了 [Reactive Resume](https://rxresu.me/)；本项目目前专注于已有文件的保存和使用。

## 产品需求与后续设计

[查看需求与设计讨论稿](docs/requirements.md)和[页面方案讨论稿](docs/page-blueprints.md)。文档区分已确认方向、待讨论建议与当前已实现功能。

## 本地开发

需要 Node.js 22.13 或更高版本。

```sh
npm ci
```

将 `.dev.vars.example` 复制为 `.dev.vars`，将 `BETTER_AUTH_SECRET` 替换为随机生成的至少 32 字符密钥。不要提交 `.dev.vars`。本地默认地址为 `http://127.0.0.1:5173`。

```sh
npx wrangler d1 migrations apply resume-pocket-auth --local
npm run dev
```

```sh
npm test
npx tsc --noEmit
npm run build
```

本地账号和文件存储在 `.wrangler` 中，不会同步到生产环境。

## 部署到 Cloudflare

1. 创建 D1 数据库和 R2 存储桶，将对应的名称及数据库 ID 写入 `wrangler.jsonc`。
2. 在目标 Worker 中设置 `BETTER_AUTH_SECRET` 和 `BETTER_AUTH_URL`。前者必须是随机密钥；后者是网站的 HTTPS 地址。
3. 先验证本地迁移，再根据工作区的数据库安全规范执行生产数据库迁移。
4. 执行 `npm run build` 和 `npm run deploy`，或在 Cloudflare 中连接本仓库并使用相同的构建和部署命令。

不要提交用户简历、密钥、本地数据库或浏览器会话。部署前应根据面向公众的需求完善邮箱验证、密码找回、存储配额、备份和滥用防护。
