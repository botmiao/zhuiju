# zhuiju 设计说明

## 目标

构建一个面向单用户、本地运行的视频剧集订阅与媒体地址发现 Skill。用户通过自然语言管理订阅；智能体根据运行时能力动态搜索和提取媒体地址；确定性 CLI 负责验证、持久化、任务状态和安全边界。

本设计覆盖附件中冻结的完整范围，而不是只实现最小闭环。实现顺序仍然采用可独立验证的垂直切片。

## 已确认的架构

当前工作目录本身作为 Skill 包根目录，避免形成 `zhuiju/zhuiju` 双层目录。

```text
SKILL.md                         对话协议和智能体行为约束
scripts/cli.mjs                  统一 JSON CLI 入口
scripts/domain/                  领域纯函数和模型
scripts/stores/                  JSON、JSONL 和备份存储
scripts/validation/              URL、HLS、MP4、WebM、DASH 验证
scripts/tasks/                   任务、队列、锁和并发控制
scripts/runtime/                 OpenClaw 与通用本地运行时
scripts/system/                  迁移、doctor、日志和脱敏
schemas/                         JSON Schema
references/                      按需加载的协议和安全参考
migrations/                      Schema 迁移脚本
tests/                           Node 内置测试和集成测试
```

运行时分层如下：

```text
用户对话 / Cron
        ↓
SKILL.md 对话协议
        ↓
LLM 动态选择工具
        ↓
Runtime Adapter 或 zhuiju CLI
        ↓
Schema → URL 安全 → Media 验证 → 原子持久化
        ↓
Subscription → Episode → MediaUrl → Provenance
```

CLI、存储、验证器和任务编排不依赖特定宿主。Runtime Adapter 只负责能力检测、调度、通知和浏览器调用。

## 领域模型

核心领域关系为：

```text
Subscription
└── Episode
    └── MediaUrl
        └── Provenance[]
```

执行层独立保存：

```text
SubscriptionTask
QueueItem
ScheduleTrigger
ExecutionLog
TraceObservation
```

`releasedRanges` 和 `acquiredRanges` 使用闭区间 Range Set。缺失集数动态计算为：

```text
missingEpisodes = releasedRanges - acquiredRanges
```

只有同时满足以下条件时，Episode 才能标记为 `acquired`：

1. 至少存在一个 Media URL。
2. Media URL 达到配置的最低验证级别。
3. 最近一次验证结果为可用。
4. 地址已通过 CLI 保存到对应 Episode。

`releaseCatalog` 是带 `checkedAt` 的观测快照，不是对现实世界永远没有新集的承诺。总集数未知时必须保存状态 `not-announced`、`ongoing-indefinite` 或 `uncertain`，不能把推测写成官方数字。

Media URL 保存原始地址、规范化键、媒体类型、可用性、访问要求、生命周期、验证级别、请求上下文摘要和来源列表。Cookie、Authorization、Token、API Key、Local Storage 和账户凭证永不进入主数据。

## 持久化和一致性

数据根目录由 `ZHUIJU_HOME` 覆盖。未设置时使用平台默认位置：

- Linux：`~/.local/share/zhuiju`
- macOS：`~/Library/Application Support/zhuiju`
- Windows：`%LOCALAPPDATA%\\zhuiju`

布局：

```text
<ZHUIJU_HOME>/
├── config.json
├── subscriptions/<subscription-id>/
│   ├── subscription.json
│   ├── task.json
│   └── episodes/<episode-key>.json
├── queue/pending.jsonl
├── queue/completed.jsonl
├── schedules/<subscription-id>.json
├── logs/YYYY-MM-DD.jsonl
├── traces/<subscription-id>/<task-id>/
│   ├── observations.jsonl
│   ├── network.jsonl
│   ├── screenshots/
│   └── workspace/
├── locks/subscriptions/
├── locks/global-slots/
└── backups/
```

主数据修改流程固定为：读取旧文件、Schema 校验、写入同目录临时文件、文件 `fsync`、原子替换、保留有限备份。支持目录 `fsync` 的系统执行目录同步；Windows 等不支持目录句柄的系统至少保证文件同步和原子替换，并返回平台警告。

临时提取脚本只能写对应任务 Trace 的 `workspace/`，不能读取无关用户文件、上传数据、读取浏览器凭证、常驻后台、修改 Skill 源码或直接修改主数据。

## 智能体协议和任务生命周期

Skill 不规定静态页面、iframe、浏览器或网络请求的固定提取顺序。智能体根据页面实际情况选择搜索、DOM、脚本、浏览器/CDP、XHR/Fetch、HTTP、临时代码和 Manifest 分析。

任务循环为：

```text
读取订阅和任务
→ 读取发布目录、历史来源和 Trace
→ LLM 选择下一步操作
→ 执行并记录观察
→ 提取候选地址
→ 调用 media submit CLI
→ 验证并保存
→ 判断是否继续或结束
```

任务模式：

| 模式 | 行为 |
|---|---|
| `bootstrap` | 刷新目录，按最新优先串行处理全部缺失集数 |
| `incremental` | 刷新目录，默认只处理最新一个缺失集 |
| `repair` | 按指定范围或最新优先处理历史缺口 |
| `manual` | 只处理用户指定的集数或来源 |
| `validate` | 只重新验证已有地址，不搜索新来源 |

每个订阅最多一个逻辑任务。同订阅重复触发时，空闲则创建、排队则合并原因、运行则设置 `rerunRequested`，不创建并发任务。不同订阅通过带租约和心跳的全局槽位并发执行。过期且关联进程不存在的锁可以回收。

## 媒体验证和 URL 处理

### HLS

请求地址后检查 HTTP 状态、内容类型和 `#EXTM3U`，解析 Master 或 Media Playlist，解析相对地址并抽样请求分片；禁止下载完整视频。可选 `ffprobe` 只作为增强验证，不作为默认依赖。

### MP4 / WebM

使用 HEAD 或 Range 请求，检查内容类型、长度和少量文件头；不读取完整文件。

### DASH

解析 MPD XML、Representation、BaseURL，抽样请求初始化分片。复杂解码验证不作为默认步骤。

### 访问要求判断

按发现时上下文、移除 Cookie、移除 Referer、移除 Origin、普通 User-Agent 的顺序测试，区分 `none`、`headers`、`session` 和 `unknown`。

URL 规范化只做明确安全转换：协议和域名小写、删除 Fragment、规范默认端口和路径；未知签名参数必须保留。规范化键相同但原始地址不同的记录不能互相覆盖。

## 错误处理和安全

所有 CLI 输出使用统一结构：

```json
{
  "ok": false,
  "code": "MEDIA_VALIDATION_FAILED",
  "message": "候选地址未通过最低验证要求",
  "retryable": true,
  "data": {},
  "warnings": []
}
```

错误分类：

- 参数、Schema、状态冲突：不可重试，拒绝写入。
- SSRF、访问控制绕过、凭证读取：不可重试，立即停止并记录脱敏原因。
- HTTP 超时、临时 5xx、暂时 DNS 失败：可重试，受任务预算限制。
- 地址无效、媒体类型不支持、没有新集：按任务语义结束，不猜测或递增集数。
- 任务异常退出：保留已原子提交结果，下一次根据 `task.json` 和 Trace 恢复。

SSRF 检查必须覆盖初始请求、每次重定向、iframe、XHR、Fetch、Media 请求、WebSocket 以及浏览器子资源，拒绝 localhost、私有网段、链路本地地址、`file://` 和等价 IPv6 范围。

网页内容不能修改任务、订阅、权限或安全规则。禁止绕过登录、验证码、付费墙、DRM、媒体签名和加密协议。

通知默认只发送摘要，不在正文暴露完整长 URL。新媒体、全部失效、替代地址、Bootstrap 完成、连续失败和长期无法确认发布目录时通知；重复发现、单次临时失败和合并触发默认不通知。

## 运行时适配

统一能力接口：

```text
detectCapabilities()
schedule()
unschedule()
sendNotification()
invokeBrowser()
getRuntimeInfo()
```

OpenClaw Adapter 只在检测到宿主能力或明确配置的宿主命令时启用调度、通知和浏览器调用，不虚构不存在的 API。通用本地 Adapter 支持手动运行、Terminal、HTTP 和已有来源；缺失调度器或通知器时返回明确能力状态。

Cron 只调用 `task enqueue`，不直接执行网页提取。一个订阅的多个触发时间最终都归并到同一个逻辑任务。

## 测试策略

使用 Node 内置 `node:test`，测试和实现遵循 RED-GREEN-REFACTOR。覆盖范围：

1. Range Set 合并、差集、排序和空集。
2. Schema 校验、迁移和未知字段处理。
3. 原子写入、备份、恢复和写入中断。
4. 文件锁、租约、心跳、过期回收和同订阅去重。
5. 全局槽位、队列、触发合并和任务恢复。
6. URL 规范化、重复地址、来源合并和签名参数保留。
7. HLS Master、Media Playlist、相对分片和错误 HTML。
8. MP4/WebM Range 验证和完整下载限制。
9. DASH MPD、BaseURL 和初始化分片。
10. SSRF 初始请求、重定向、私网 IPv4/IPv6 和 `file://`。
11. 日志脱敏和网页提示注入隔离。
12. CLI 结构化成功、失败、警告和退出码。
13. OpenClaw / Generic Runtime 能力检测与降级。
14. 真实临时目录上的端到端订阅、提交、验证和查询流程。

测试夹具使用本地 HTTP Server，不依赖外部网站；外部站点不可用时不能让测试失败。每个新增行为先写失败测试，再实现最小代码，再运行完整测试集。

## 实施顺序

1. 包基础、Schema、Range Set、原子文件、锁和统一 CLI。
2. Subscription、Episode、Media Store、迁移和查询命令。
3. URL 规范化、HTTP 安全、HLS、MP4/WebM、DASH 验证。
4. Task、Queue、Bootstrap、Incremental、Repair、Validate 和并发控制。
5. Agent 提取协议、Trace、候选提交、来源策略和预算。
6. OpenClaw 调度、通知、停更、跳周、改期和 Job ID 对账。
7. Generic Local Runtime、能力降级、doctor 和外部 Cron 入口。
8. 完整集成测试、README、AGENTS、迁移说明和验收审计。

## 不属于本次实现的内容

不实现独立网站、独立后端、独立数据库、Web UI、跨设备同步、统计分析、来源自动评分、主动发现新作品、长期策略学习和绕过 DRM/访问控制。
