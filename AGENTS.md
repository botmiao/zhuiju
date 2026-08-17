# zhuiju Agent 指南

## 项目规则

- 修改 Agent 行为前，先阅读 `SKILL.md` 以及相关的 `references/` 文件。
- 将确定性的状态变更放在 `scripts/` 中；绝不要要求 LLM 直接编辑主 JSON 文件。
- 通过 `ZHUIJU_HOME` 将运行时数据放在包目录之外。
- 保持安全边界：不得绕过访问控制、收集凭据、猜测 URL，或下载完整视频进行验证。
- 新增行为必须先有失败测试，再实现最小改动，最后运行完整测试。

## 命令

本工作区使用由 `fnm` 管理的 Node.js 和 PowerShell。可用时，为 shell 命令加上 `rtk` 前缀：

```powershell
rtk npm test
rtk npm install
rtk node scripts/cli.mjs doctor
```

不要将输出重定向到名为 `nul` 的文件；只有确实需要抑制输出时，才使用 PowerShell 的 `$null` 或 `Out-Null`。

## 目录结构

- `SKILL.md`：面向 Agent 的协议。
- `scripts/`：确定性 CLI、存储、验证器、任务模块和运行时适配器。
- `schemas/`：持久化数据契约。
- `references/`：渐进式披露的参考文档。
- `tests/`：单元测试和集成测试。
- `docs/superpowers/`：设计文档和实施计划。

## 验证

在声称工作完成前，运行 `rtk npm test`，在隔离的 `ZHUIJU_HOME` 中执行相关 CLI 命令，并检查实际的 JSON 输出。本工作区最初不是 Git 仓库，因此除非 Git 已初始化且提交命令成功，否则不要声称已经创建提交。
