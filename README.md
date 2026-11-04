# 简历口袋

把 PDF 简历收在自己的空间里，需要时可以在电脑或手机上打开、打印、下载或删除。项目首先解决已有简历的保存和展示；在线制作和模板编辑留待后续实现。

## 当前功能

- 邮箱验证码注册和登录；已验证账号可使用密码登录，通过邮箱验证码重置密码。每个账号只能访问自己的文件。
- 上传 PDF 或 Word（DOCX、DOC），单个文件最大 10 MB；Word 自动转换为 PDF 在线预览，可打印，默认下载原文件，也可下载 PDF 版本。游客仅支持 PDF。
- 数据保存在 Cloudflare D1 和 R2，登录同一账号可跨设备访问。
- 每个投递对象使用独立分享链接，可设置期限、停用和重新启用；已发链接自动显示新版简历，支持公开信息卡、投递留言和访问记录。
- 用户在 `/app/stats` 查看自己的简历数量、分享状态和近 7 天访问；管理员在 `/app/admin` 查看全站汇总，不展示他人的私人信息。
- 手机分享页支持缩放和可复制的文字阅读；打印保留原排版。在线且处于前台时每 30 秒确认链接状态，发现失效后移除简历；手动停用时提示 5 秒并返回首页。离线或浏览器暂停时不能保证即时移除。
- 账户设置支持邮箱确认后永久注销，清理全部文件版本、分享和访问记录。游客简历 14 天后不可访问，每小时自动清理文件及关联记录。
- 在线制作和模板编辑尚未开放。

界面和产品方向参考了 [Reactive Resume](https://rxresu.me/)；本项目目前专注于已有文件的保存和使用。

## 产品需求与后续设计

[查看需求与设计讨论稿](docs/requirements.md)和[页面方案讨论稿](docs/page-blueprints.md)。文档区分已确认方向、待讨论建议与当前已实现功能。

## 本地开发

需要 Node.js 22.13 或更高版本。

```sh
npm ci
```

将 `.dev.vars.example` 复制为 `.dev.vars`，将 `BETTER_AUTH_SECRET` 替换为随机生成的至少 32 字符密钥。另用 `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` 生成 `SHARE_TOKEN_KEY`，用于加密分享标识，不可随意更换，否则已有链接无法在后台恢复。不要提交 `.dev.vars`。本地默认地址为 `http://127.0.0.1:5173`；`EMAIL_FROM` 留空时验证码仅打印到本地终端。

```sh
npx wrangler d1 migrations apply resume-pocket-auth --local
npm run dev
```

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

本地账号和文件存储在 `.wrangler` 中，不会同步到生产环境。

## 部署到 Cloudflare

1. 创建 D1 数据库和 R2 存储桶，将对应的名称及数据库 ID 写入 `wrangler.jsonc`。
2. 在目标 Worker 中设置 `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`ADMIN_EMAILS` 和 `SHARE_TOKEN_KEY`。认证密钥至少 32 字符；分享密钥须为 32 个随机字节的 Base64 编码；`BETTER_AUTH_URL` 是网站的 HTTPS 地址；`ADMIN_EMAILS` 是可进入 `/app/admin` 的管理员邮箱，多个用英文逗号分隔。四者均为必填密钥，缺少任一项部署会失败。
3. Word 转换使用 Cloudflare Containers（`converter/` 下的 LibreOffice 镜像，需 Workers Paid 套餐）；`npm run deploy` 会在本机用 Docker 构建并推送镜像，因此部署机器需要 Docker。本地 dev 不启动容器（插件在 Windows 上不支持，`dev.enable_containers` 已关闭）：先用 Docker 构建并运行转换镜像（`docker build -t rp-converter-test --build-arg APT_MIRROR=mirrors.tuna.tsinghua.edu.cn converter`，`docker run -d --name rp-conv -p 18080:8080 rp-converter-test`），再在 `.dev.vars` 设置 `WORD_CONVERTER_URL=http://127.0.0.1:18080`。
4. 为 R2 存储桶添加生命周期规则：前缀 `guests/` 的对象 14 天后删除。`wrangler.jsonc` 配置每小时第 17 分钟执行游客清理，按原上传时间删除到期文件，并级联清理关联分享和访问明细；同时补清理已被 R2 生命周期删除的游客文件的孤立记录，不处理注册用户文件。限流绑定也随部署生效。
5. 先验证本地迁移，再根据工作区的数据库安全规范执行生产数据库迁移。
6. 执行 `npm run build` 和 `npm run deploy`，或在 Cloudflare 中连接本仓库并使用相同的构建和部署命令。

不要提交用户简历、密钥、本地数据库或浏览器会话。

## 文件更新与账号安全

- 密码直接注册已关闭，新账号必须通过邮箱验证码取得使用权限。历史未验证账号需使用验证码登录或重置密码；验证时撤销未验证阶段的旧访问。管理员必须同时满足邮箱已验证和服务端允许名单。
- 会话实时向服务器确认，撤销或重置密码后旧会话立即失效；同一页面请求内复用读取结果。
- Word 每次更新先保存独立原件，再原子发布 PDF 与对应原件的引用。发布失败不会覆盖旧原件；即使发布响应丢失，已发布文件仍保持配对。已有固定路径的文件保持兼容。
- 旧 Word 版本和未发布的暂存原件不对外开放，保留到该简历被删除，保证更新期间正在下载的请求仍可完成；删除简历会清理其所有原件版本。这会增加反复更新 Word 文件的存储用量，后续可加入带保留窗口的回收任务。
- 注销先停用账户文件空间并清理其内容，再由 Better Auth 删除用户、凭据和会话。失败时保留账户以便重试；仅保留不含内容的 `.deleted` 标记，防止注销前在途上传重新留下文件。注销要求近期认证，设置页先完成一次邮箱验证。
- 统计按北京时间计算，访问量来自现存分享记录，删除后不再计入。历史累计可能包含启用访问明细前的计数，因此不保证等于明细总数。管理员仅返回汇总，用户范围由服务端确定。
- `npm test` 包含真实 Better Auth 会话/验证码/注销回归、本地 R2 故障与并发测试，以及 D1 的统计隔离和清理范围验证，不连接线上数据库或发送真实邮件。
