function readCfg(cfg) {
  const baseUrl = cfg?.channels?.ntfy?.baseUrl || process.env.NTFY_BASE_URL || 'http://118.89.62.149:8090'
  const topicIn = cfg?.channels?.ntfy?.topicIn || process.env.NTFY_TOPIC_IN || 'openclaw_in'
  const topicOut = cfg?.channels?.ntfy?.topicOut || process.env.NTFY_TOPIC_OUT || 'openclaw_out'
  return { baseUrl: String(baseUrl), topicIn: String(topicIn), topicOut: String(topicOut) }
}

function getCoreRuntime() {
  const rt = globalThis.__openclaw_ntfy_runtime
  if (!rt) throw new Error('OpenClaw runtime not initialised (expected globalThis.__openclaw_ntfy_runtime)')
  return rt
}

async function httpRequest(url, opts) {
  const { request } = await import(url.startsWith('https:') ? 'node:https' : 'node:http')
  const { URL } = await import('node:url')
  const u = new URL(url)
  return await new Promise((resolve, reject) => {
    const req = request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        method: opts.method,
        headers: opts.headers,
      },
      (res) => {
        resolve(res)
      },
    )
    req.on('error', reject)
    if (opts.signal) {
      const onAbort = () => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        req.destroy(err)
      }
      if (opts.signal.aborted) {
        onAbort()
        return
      }
      opts.signal.addEventListener('abort', onAbort, { once: true })
      req.on('close', () => opts.signal.removeEventListener('abort', onAbort))
    }
    if (opts.body != null) req.write(opts.body)
    req.end()
  })
}

async function publishText(url, text) {
  const res = await httpRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-length': Buffer.byteLength(text),
    },
    body: text,
  })
  res.resume()
}

async function* sseStream(url, signal, log) {
  const res = await httpRequest(url, {
    method: 'GET',
    headers: { accept: 'text/event-stream' },
    signal,
  })
  const ct = res.headers?.['content-type'] || ''
  log(`[ntfy] sse connected ${res.statusCode} content-type=${ct}`)
  if (res.statusCode !== 200 || !String(ct).includes('text/event-stream')) {
    res.resume()
    throw new Error(`unexpected SSE response: status=${res.statusCode} content-type=${ct}`)
  }
  res.setEncoding('utf8')
  let buf = ''
  for await (const chunk of res) {
    buf += String(chunk).replace(/\r\n/g, '\n')
    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const lines = raw.split('\n')
      let id = null
      let ev = null
      const data = []
      for (const line of lines) {
        if (line.startsWith('id:')) id = line.slice(3).trim()
        if (line.startsWith('event:')) ev = line.slice(6).trim()
        if (line.startsWith('data:')) data.push(line.slice(5))
      }
      if (data.length === 0) continue
      const payload = { id, event: ev, data: data.join('\n') }
      if (payload.event && payload.event !== 'keepalive') {
        log(`[ntfy] sse event ${payload.event} id=${payload.id || '-'} bytes=${payload.data?.length ?? 0}`)
      }
      yield payload
    }
  }
}

async function dispatchText(cfg, runtime, toUrl, text, messageId) {
  const core = getCoreRuntime()
  const route = core.channel.routing.resolveAgentRoute({
    cfg,
    channel: 'ntfy',
    accountId: runtime.accountId ?? 'default',
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
  let stopped = false
  const { dispatcher, replyOptions, markDispatchIdle } = core.channel.reply.createReplyDispatcherWithTyping({
    responsePrefix: '',
    responsePrefixContextProvider: async () => ({}),
    humanDelay: { enabled: false },
    onReplyStart: async () => {},
    deliver: async (payload) => {
      if (stopped) return
      const t = payload?.text?.trim()
      if (!t) return
      await publishText(toUrl, t)
    },
    onError: async () => {},
    onIdle: async () => {
      stopped = true
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

export async function monitorNtfyProvider(opts) {
  const cfg = opts.config
  const runtime = { env: opts.runtimeEnv, accountId: opts.accountId ?? 'default' }
  const log = runtime.env?.log ?? ((...args) => console.log(...args))
  const error = runtime.env?.error ?? ((...args) => console.error(...args))
  const { baseUrl, topicIn, topicOut } = readCfg(cfg)
  const base = baseUrl.trim().replace(/\/+$/, '')
  const inUrl = `${base}/${encodeURIComponent(topicIn)}/sse`
  const outUrl = `${base}/${encodeURIComponent(topicOut)}`
  log(`[ntfy] subscribing ${inUrl}`)
  log(`[ntfy] publishing to ${outUrl}`)
  const dedup = new Set()
  let lastKeepaliveLogAt = 0
  let backoff = 1000
  while (!(opts.abortSignal?.aborted)) {
    try {
      for await (const ev of sseStream(inUrl, opts.abortSignal, log)) {
        let id = String(ev.id || `${Date.now()}:${Math.random()}`)
        let dataText = String(ev.data || '').trim()
        let eventName = ev.event || null
        if (dataText.startsWith('{') && dataText.endsWith('}')) {
          try {
            const obj = JSON.parse(dataText)
            id = String(obj.id || id)
            eventName = obj.event || eventName
            dataText = String(obj.message || obj.title || obj.body || dataText)
          } catch {}
        }
        if (eventName === 'keepalive') {
          const now = Date.now()
          if (now - lastKeepaliveLogAt > 300000) {
            log('[ntfy] keepalive')
            lastKeepaliveLogAt = now
          }
          continue
        }
        if (dedup.has(id)) continue
        dedup.add(id)
        if (dedup.size > 5000) dedup.clear()
        const text = dataText
        if (!text) continue
        log(`[ntfy] in ${id}: ${text.slice(0, 120)}`)
        await dispatchText(cfg, runtime, outUrl, text, id)
      }
      backoff = Math.min(backoff * 2, 30000)
    } catch (e) {
      if (opts.abortSignal?.aborted) {
        log('[ntfy] stopped (abort signal)')
        return
      }
      if (e && typeof e === 'object' && (e.name === 'AbortError' || e.message === 'aborted')) {
        log('[ntfy] stopped (aborted)')
        return
      }
      error(`[ntfy] monitor error: ${e instanceof Error ? e.stack || e.message : String(e)}`)
      await new Promise((r) => setTimeout(r, backoff))
      backoff = Math.min(backoff * 2, 30000)
    }
  }
}
