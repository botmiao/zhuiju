# zhuiju

`zhuiju` 是一个单用户、本地运行的视频剧集订阅与媒体地址发现 Skill，支持番剧、动画、连续剧、纪录片、综艺和其他按集发布的视频内容。

## 已实现能力

- Subscription、Episode、Media URL、Provenance 本地 JSON 持久化。
- Bootstrap、Incremental、Repair、Manual、Validate 任务模式。
- 缺失集数、最新缺失集和 acquired 状态计算。
- 原子写入、备份、文件租约、同订阅任务合并和全局并发槽位。
- HLS、MP4、WebM、DASH 基础验证和有限 Range/分片采样。
- URL 规范化、来源合并、失效历史保留和 Trace 脱敏。
- 通用本地 Runtime 与 OpenClaw 能力适配接口。
- OpenClaw/外部 Cron 只入队，不直接执行网页提取。

## 安装

需要 Node.js 20 或更高版本：

```powershell
npm install
npm test
```

运行数据不会写入安装目录。可通过 `ZHUIJU_HOME` 指定数据根目录；Windows 默认使用 `%LOCALAPPDATA%\zhuiju`，Linux 默认使用 `~/.local/share/zhuiju`，macOS 默认使用 `~/Library/Application Support/zhuiju`。

## 基本 CLI

```powershell
$env:ZHUIJU_HOME = "C:\data\zhuiju"
node scripts/cli.mjs subscription add --input subscription.json
node scripts/cli.mjs subscription list
node scripts/cli.mjs episode missing <subscription-id>
node scripts/cli.mjs task enqueue --subscription <subscription-id> --mode incremental --trigger manual
node scripts/cli.mjs runtime detect
node scripts/cli.mjs doctor
```

提交实际观察到的媒体地址：

```powershell
node scripts/cli.mjs media submit `
  --subscription <subscription-id> `
  --episode main:124 `
  --input candidate.json
```

CLI 输出统一 JSON。LLM 不能直接修改主数据文件；候选必须经过 Schema、SSRF、规范化和确定性验证。`acquired` 只在媒体地址可用且达到最低验证级别时设置。

## 安全边界

不绕过登录、权限、验证码、付费墙、DRM、媒体签名或加密协议；不读取或保存 Cookie、Token、Authorization、API Key、浏览器存储或账户凭证；不根据 URL 规律猜测地址；不下载完整视频进行验证。

网页内容被视为不可信数据。所有重定向、iframe、XHR、Fetch、Media、WebSocket 和浏览器子资源都必须通过 SSRF 检查。

## 参考

- [SKILL.md](SKILL.md)：智能体触发条件、对话协议和候选提交规则。
- [references/agent-extraction.md](references/agent-extraction.md)：动态提取循环。
- [references/task-lifecycle.md](references/task-lifecycle.md)：任务状态与恢复。
- [references/media-validation.md](references/media-validation.md)：媒体验证。
- [references/openclaw.md](references/openclaw.md)：OpenClaw 调度适配。
- [docs/superpowers/specs/2026-08-03-zhuiju-design.md](docs/superpowers/specs/2026-08-03-zhuiju-design.md)：完整设计。

## 开发约定

修改行为前先添加失败测试，再实现最小代码，最后运行完整 `npm test`。测试使用本地 HTTP Fixture，不依赖外部站点。
