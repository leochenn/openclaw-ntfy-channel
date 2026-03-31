---
name: ntfy-sender
description: Send notifications to an ntfy service. Use when a user asks to send a message, notification, or alert to an ntfy topic (e.g., "向ntfy服务发送xxx消息", "send notification to ntfy", "push message to ntfy"). The skill sends HTTP POST requests to an ntfy endpoint with configurable title, priority, and topic.
---

# Ntfy Sender

## Overview

This skill enables sending notifications to an ntfy service via HTTP POST. It's designed to deliver quick alerts, messages, and notifications to subscribed devices and applications. The skill uses a pre-configured ntfy endpoint and supports customizable titles, priority levels, and topics.

**Current Configuration:**
- **Endpoint:** `http://<ntfy-server>:8090/openclaw_in2`
- **Default topic:** `openclaw_in2`

## Quick Start

The simplest usage sends a message with defaults:

```bash
scripts/send_ntfy.py "Your message here"
```

Or with custom title and priority:

```bash
scripts/send_ntfy.py "Server CPU is at 95%" --title "🚨 Alert: High CPU" --priority high
```

## How to Use

### Trigger Phrases

This skill triggers when users say things like:
- "向ntfy服务发送xxx消息"
- "Send this to ntfy: [message]"
- "Push a notification to ntfy"
- "Notify me via ntfy that [message]"
- "Send an ntfy alert with content: [message]"

### Basic Sending

Send a simple message:

```bash
scripts/send_ntfy.py "这是一条测试消息"
```

Result: Message sent to the default topic with priority "default".

### Customized Messages

Enhance messages with title and priority:

```bash
scripts/send_ntfy.py "Backup completed successfully" \
  --title "✅ Backup Status" \
  --priority low
```

Priority options: `low`, `default`, `high`

### Different Topics

Send to a different topic/subpath:

```bash
scripts/send_ntfy.py "Urgent: Database connection lost" \
  --topic "alerts/critical" \
  --priority high
```

## Integration with OpenClaw

When integrated as a skill, OpenClaw will:
1. Detect ntfy-related requests from user messages
2. Extract the message content
3. Execute `scripts/send_ntfy.py` with appropriate arguments
4. Report success/failure back to the user

## Error Handling

The script returns exit codes:
- `0`: Success (message sent)
- `1`: Failure (network error, timeout, or server error)

Error messages include details about what went wrong (connection refused, timeout, etc.).

## Security Notes

- The ntfy endpoint is currently configured as an HTTP (non-TLS) endpoint
- Ensure the endpoint is trusted and on a secure network
- Message content is sent in plain text over the network
- No authentication is currently configured
- Consider adding authentication headers if the ntfy service requires it

## Resources

### scripts/
- `send_ntfy.py` - Main script for sending ntfy messages
