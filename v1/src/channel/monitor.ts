import type { ClawdbotConfig, RuntimeEnv } from 'openclaw/plugin-sdk'

type MonitorOpts = { config: ClawdbotConfig; runtime?: RuntimeEnv; abortSignal?: AbortSignal }

function readCfg(cfg: ClawdbotConfig) {
  const baseUrl = (cfg as any)?.channels?.ntfy?.baseUrl || process.env.NTFY_BASE_URL || 'http://<ntfy-server>:8090'
  const topicIn = (cfg as any)?.channels?.ntfy?.topicIn || process.env.NTFY_TOPIC_IN || 'openclaw_in'
  const topicOut = (cfg as any)?.channels?.ntfy?.topicOut || process.env.NTFY_TOPIC_OUT || 'openclaw_out'
  return { baseUrl: String(baseUrl), topicIn: String(topicIn), topicOut: String(topicOut) }
}

async function publishText(url: string, text: string) {
  await fetch(url, { method: 'POST', body: text })
}

async function* sseStream(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal, headers: { Accept: 'text/event-stream' } })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const r = await reader.read()
    if (r.done) break
    buf += decoder.decode(r.value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const lines = chunk.split('\n')
      let id: string | null = null
      let data: string[] = []
      for (const line of lines) {
        if (line.startsWith('id:')) id = line.slice(3).trim()
        if (line.startsWith('data:')) data.push(line.slice(5))
      }
      yield { id, data: data.join('\n') }
    }
  }
}

async function dispatchText(cfg: ClawdbotConfig, runtime: RuntimeEnv, toUrl: string, text: string, messageId: string) {
  const core = (runtime as any)
  const route = core.channel.routing.resolveAgentRoute({
    cfg,
    channel: 'ntfy',
    accountId: 'default',
    peer: { kind: 'direct', id: 'ntfy-user' },
  })
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: text,
    BodyForAgent: text,
    RawBody: text,
    CommandBody: text,
    From: 'ntfy:user',
    To: 'ntfy:topic',
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: 'direct',
    SenderName: 'ntfy-user',
    SenderId: 'ntfy-user',
    Provider: 'ntfy',
    Surface: 'ntfy',
    MessageSid: messageId,
    Timestamp: Date.now(),
    WasMentioned: false,
    OriginatingChannel: 'ntfy',
    OriginatingTo: 'ntfy:topic',
  })
  let typingStopped = false
  const { dispatcher, replyOptions, markDispatchIdle } = core.channel.reply.createReplyDispatcherWithTyping({
    responsePrefix: '',
    responsePrefixContextProvider: async () => ({}),
    humanDelay: { enabled: false },
    onReplyStart: async () => {},
    deliver: async (payload: { text?: string }) => {
      if (typingStopped) return
      const t = payload?.text?.trim()
      if (!t) return
      await publishText(toUrl, t)
    },
    onError: async () => {},
    onIdle: async () => {
      typingStopped = true
    },
    onCleanup: async () => {},
  })
  await core.channel.reply.dispatchReplyFromConfig({
    ctx: ctxPayload,
    cfg,
    dispatcher,
    replyOptions: { ...replyOptions, disableBlockStreaming: true },
  })
  await dispatcher.waitForIdle()
  markDispatchIdle()
}

export async function monitorNtfyProvider(opts: MonitorOpts): Promise<void> {
  const cfg = opts.config
  const runtime = opts.runtime!
  const { baseUrl, topicIn, topicOut } = readCfg(cfg)
  const inUrl = `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(topicIn)}`
  const outUrl = `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(topicOut)}`
  const dedup = new Set<string>()
  let backoff = 1000
  while (!(opts.abortSignal?.aborted)) {
    try {
      for await (const ev of sseStream(inUrl, opts.abortSignal)) {
        const id = String(ev.id || `${Date.now()}:${Math.random()}`)
        if (dedup.has(id)) continue
        dedup.add(id)
        const text = String(ev.data || '').trim()
        if (!text) continue
        await dispatchText(cfg, runtime, outUrl, text, id)
      }
      backoff = Math.min(backoff * 2, 30000)
    } catch {
      await new Promise((r) => setTimeout(r, backoff))
      backoff = Math.min(backoff * 2, 30000)
    }
  }
}

