import type { ChannelPlugin, ClawdbotConfig } from 'openclaw/plugin-sdk'
import { DEFAULT_ACCOUNT_ID } from 'openclaw/plugin-sdk/account-id'
import { monitorNtfyProvider } from './monitor'

export const ntfyPlugin: ChannelPlugin<{}> = {
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
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
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
      accountId: DEFAULT_ACCOUNT_ID,
      enabled: true,
      configured: true,
      name: 'default',
      appId: null as unknown as string,
      brand: null as unknown as string,
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
      const accountId = DEFAULT_ACCOUNT_ID
      ctx.setStatus({ accountId, port: null })
      return monitorNtfyProvider({
        config: ctx.cfg as ClawdbotConfig,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
      })
    },
    stopAccount: async () => {},
  },
}

