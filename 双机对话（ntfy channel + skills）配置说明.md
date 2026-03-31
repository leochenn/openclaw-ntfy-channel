# 双机对话（ntfy channel + skills）配置说明

本文档描述如何让两台电脑上的小龙虾 OpenClaw 通过 ntfy channel 进行双向对话，并在电脑 A 上通过 skills 给另一台电脑发送消息。

## 示意图

![示意图1](assets/图1.png)

![示意图2](assets/图2.png)

![示意图3](assets/图3.png)

## 配置流程

### 1. 在电脑 A 放置 skills

在电脑 A 的 OpenClaw 工作目录下，将本仓库的 `skills` 目录放到：

- `openclaw\workspace\skills\`

用途：提供一个用于给另一台电脑上的 OpenClaw 发送消息的 skills（通过命令前缀响应 skill，例如触发“给 ntfy 服务发送消息：xxxx”）。

本仓库示例 skills 路径：

- `c:\Users\Administrator\Desktop\openclaw-channel\skills\`

### 2. 电脑 A 的 OpenClaw 配置（ntfy channel）

在电脑 A 的 OpenClaw 配置文件中添加/修改：

```json
{
  "channels": {
    "ntfy": {
      "enabled": true,
      "baseUrl": "http://118.89.62.149:8090",
      "topicIn": "openclaw_in",
      "topicOut": "openclaw_in2"
    }
  }
}
```

### 3. 电脑 B 的 OpenClaw 配置（ntfy channel）

在电脑 B 的 OpenClaw 配置文件中添加/修改：

```json
{
  "channels": {
    "ntfy": {
      "enabled": true,
      "baseUrl": "http://118.89.62.149:8090",
      "topicIn": "openclaw_in2",
      "topicOut": "openclaw_in"
    }
  }
}
```

## 方向对应关系

- 电脑 A：接收 `openclaw_in`，发送 `openclaw_in2`
- 电脑 B：接收 `openclaw_in2`，发送 `openclaw_in`

两台机器的 `topicIn` / `topicOut` 互为对端，从而实现双向消息流转与对话。
