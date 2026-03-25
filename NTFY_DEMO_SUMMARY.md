# OpenClaw ntfy Demo 总结

## 1. demo 项目做了什么

本 demo 实现了一个极简的 OpenClaw “频道（channel）”插件，用 ntfy 作为消息总线，完成单用户、纯文本的双向对话：

- **入站**：订阅 ntfy 的 `topicIn`（SSE），把收到的文本当作用户消息注入 OpenClaw 对话链路。
- **出站**：把 OpenClaw 生成的回复文本通过 HTTP POST 发布到 ntfy 的 `topicOut`。
- **目标范围**：不做鉴权、不做多用户/群聊、不做富媒体、不做线程/表情等能力，专注“能通、可调试、可部署”。

代码主要在 demo 目录中：

- `demo/index.js`：插件入口，负责注册频道并保存 OpenClaw runtime。
- `demo/src/channel/plugin.js`：频道插件定义（能力声明、账号模型最小实现、网关启动入口）。
- `demo/src/channel/monitor.js`：ntfy SSE 订阅、消息解析、派发到 OpenClaw、以及将回复发布回 ntfy。
- `demo/openclaw.plugin.json`、`demo/package.json`：让 OpenClaw CLI 能识别并从本地路径安装/链接该扩展。

## 2. demo 运行机制是什么

整体链路可以理解为：**ntfy(topicIn) → OpenClaw 主 agent → ntfy(topicOut)**。

### 2.1 插件装载与频道注册

- 通过 `openclaw plugins install <path> --link` 将本地目录作为扩展安装/链接。
- OpenClaw 启动时加载该扩展的入口文件（`demo/index.js`），并调用 `register(api)`：
  - 保存 `api.runtime` 到全局（供后续派发时使用）。
  - 通过 `api.registerChannel({ plugin: ntfyPlugin })` 注册一个 `id = "ntfy"` 的频道实现。

### 2.2 网关启动频道与健康检查

- 网关启动时会对频道做健康/状态汇总，调用频道插件的账号相关接口（例如 `listAccountIds`）。
- demo 实现了一个**最小账号模型**：
  - 固定只有一个账号：`accountId = "default"`。
  - 不提供复杂的增删改账号能力，避免引入不必要的配置管理逻辑。

### 2.3 入站：订阅 ntfy SSE 并解析消息

- 使用 Node 的 `http/https` 直接连接 `/<topicIn>/sse`，并校验响应必须是 `text/event-stream`。
- 解析 SSE 的 `event:` / `id:` / `data:` 字段：
  - 支持 `data:` 多行。
  - 对 `data` 内容若是 JSON（ntfy 常见格式）会进行解析，并优先取 `message/title/body` 作为实际文本。
  - 对 `keepalive` 事件做过滤，避免污染对话与日志。

### 2.4 派发到 OpenClaw：注入为一次“用户输入”

- 为每条入站消息构造 OpenClaw 所需的 inbound context（例如 Body、SessionKey、SenderId 等）。
- 通过 OpenClaw 内部的 reply dispatcher 将消息送入主 agent 的对话链路，并等待回复完成。

### 2.5 出站：把回复发布回 ntfy

- reply dispatcher 在产生文本回复时触发 `deliver(payload)`。
- demo 仅取 `payload.text`，做 trim 后通过 HTTP POST 发到 `/<topicOut>`。
- 对流式/分块回复做了简化处理：以“最终文本片段”为单位发布（不做富结构或逐 token 推送）。

## 3. 如何接入 OpenClaw（安装与配置）

本 demo 的接入方式有两种：

- **手动方案**：放置插件源码（3.1）+ 手动编辑 `openclaw.json`（3.2）。
- **命令行方案**：使用 `openclaw plugins install ... --link` 写入插件安装/链接信息（3.3），再按需补齐频道与路由相关项。

### 3.1 手动：放置插件源码

将插件源码放到 OpenClaw 运行环境可访问的目录中，例如：

- `/home/leo/ntfy-channel`

目录结构示例：

```
/home/leo/ntfy-channel
  src/
  index.js
  index.ts
  openclaw.plugin.json
  package.json
```

### 3.2 手动：配置项示例（写入 openclaw.json 的核心片段）

下面是与本 demo 相关的关键配置片段（示例中省略了其它无关字段）：

```json
{
  "bindings": [
    {
      "agentId": "main",
      "match": { "channel": "ntfy", "accountId": "default" }
    }
  ],
  "channels": {
    "ntfy": {
      "enabled": true,
      "baseUrl": "http://xxx.xx.62.149:8090",
      "topicIn": "openclaw_in",
      "topicOut": "openclaw_out"
    }
  },
  "plugins": {
    "load": { "paths": ["/home/leo/ntfy-channel"] },
    "entries": {
      "openclaw-ntfy-demo": { "enabled": true }
    },
    "installs": {
      "openclaw-ntfy-demo": {
        "source": "path",
        "sourcePath": "/home/leo/ntfy-channel",
        "installPath": "/home/leo/ntfy-channel",
        "version": "0.1.0",
        "installedAt": "2026-03-25T08:52:41.278Z"
      }
    }
  }
}
```

### 3.3 命令行：安装/链接本地插件

使用 CLI 将该目录安装为本地链接（便于开发迭代）：

```
openclaw plugins install /home/leo/ntfy-channel --link
```

该命令会写入 OpenClaw 的配置文件（例如 `~/.openclaw/openclaw.json`）以完成本地插件加载与启用（主要是 `plugins.load/entries/installs` 相关项）。其余频道与路由相关项仍需要按需配置（可参考 3.2 的 `bindings/channels` 部分）。

## 4. 开发过程的坑点

### 4.1 “localPath 能写进配置”是错误路径

- v2026.3.23-1 的配置校验不接受 `plugins.entries.*.localPath` 这类字段。
- 正确方式是使用 CLI：`openclaw plugins install <path> --link`，由 CLI 维护安装/链接信息。

### 4.2 插件目录结构要求（HOOK.md / package.json）

- 一开始用本地路径安装时报 `HOOK.md missing`，本质是 OpenClaw 在判断目录类型时没有识别为“扩展包”。
- 解决关键点是提供可识别的扩展入口（例如 `package.json` 声明 `openclaw.extensions` 指向入口文件）。

### 4.3 `plugins.entries.ntfy` 不是“启用频道”，而是“启用插件”

- `plugins.entries` 的 key 需要是插件 id（例如 `openclaw-ntfy-demo`），而不是频道 id（`ntfy`）。
- 写成 `plugins.entries.ntfy` 会触发 `plugin not found: ntfy` 的告警，并被忽略。

### 4.4 频道启动报 `listAccountIds`：缺少最小账号接口

- 网关健康检查会调用 `channel.config.listAccountIds` 等接口。
- 如果频道插件未实现这部分，会在启动阶段直接报错，导致频道启动失败。

### 4.5 不能把 `ctx.runtime` 当成 OpenClaw core runtime

- `startAccount(ctx)` 里拿到的 `ctx.runtime` 是运行环境（日志/退出控制等），不等同于 OpenClaw 的核心 runtime。
- 必须在 `register(api)` 阶段保存 `api.runtime`（demo 使用全局变量方式），派发时再使用它调用 channel.reply 等能力。

### 4.6 SSE 端点与数据格式差异

- ntfy 的 SSE 标准路径是 `/<topic>/sse`，直接订阅 `/<topic>` 可能得到 HTML 或其它内容。
- SSE 中会有 `keepalive` 事件；如果不滤掉，会被当作用户消息进入对话链路，污染聊天记录。

### 4.7 Ctrl+C 退出时的 “aborted” 不是错误

- 网关退出会 abort 掉长连接，底层会抛出 `aborted/AbortError`。
- demo 里将其视为正常停止：不打印堆栈，但会输出一条明确的停止日志，避免误判为故障。

## 5. 参考项目

- OpenClaw 飞书/Lark 官方 Channel 插件：openclaw-lark（https://github.com/larksuite/openclaw-lark）。本 demo 主要参考其“插件入口注册 channel、使用 runtime 派发回复”的整体集成方式。
- CodeWiki（https://codewiki.google/github.com/openclaw/openclaw）：用于辅助浏览与分析 OpenClaw 源码，并据此确认了自定义插件在已安装 OpenClaw 环境中的本地安装/链接方式（`openclaw plugins install /home/leo/ntfy-channel --link`）。

