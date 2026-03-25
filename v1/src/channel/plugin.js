import { monitorNtfyProvider } from './monitor.js'

export const ntfyPlugin = {
  id: 'ntfy',
  meta: {
    id: 'ntfy',
    label: 'ntfy',
    selectionLabel: 'ntfy',
    docsPath: '/channels/ntfy',
    docsLabel: 'ntfy',
    blurb: 'ntfy messaging.',
    aliases: [],
    order: 10,
  },
  capabilities: {
    chatTypes: ['direct'],
    media: false,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  configSchema: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        baseUrl: { type: 'string' },
        topicIn: { type: 'string' },
        topicOut: { type: 'string' },
      },
    },
  },
  config: {
    listAccountIds: () => ['default'],
    resolveAccount: (cfg, accountId) => ({
      accountId: String(accountId || 'default'),
      enabled: true,
      configured: true,
      name: 'default',
      config: cfg?.channels?.ntfy ?? {},
    }),
    defaultAccountId: () => 'default',
    setAccountEnabled: ({ cfg }) => cfg,
    deleteAccount: ({ cfg }) => cfg,
    isConfigured: () => true,
    describeAccount: (account) => ({
      accountId: account?.accountId ?? 'default',
      enabled: true,
      configured: true,
      name: 'default',
    }),
  },
  status: {
    defaultRuntime: {
      accountId: 'default',
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      port: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: true,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      port: null,
    }),
    probeAccount: async () => null,
    buildAccountSnapshot: ({ runtime }) => ({
      accountId: 'default',
      enabled: true,
      configured: true,
      name: 'default',
      appId: null,
      brand: null,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      port: null,
      probe: null,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const accountId = ctx.accountId ?? 'default'
      ctx.setStatus({ accountId, port: null })
      return monitorNtfyProvider({
        config: ctx.cfg,
        runtimeEnv: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId,
      })
    },
    stopAccount: async () => {},
  },
}
