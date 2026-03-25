import { ntfyPlugin } from './src/channel/plugin.js'

const plugin = {
  id: 'openclaw-ntfy-demo',
  name: 'ntfy',
  description: 'ntfy channel demo',
  configSchema: { type: 'object', additionalProperties: false, properties: {} },
  register(api) {
    globalThis.__openclaw_ntfy_runtime = api.runtime
    api.registerChannel({ plugin: ntfyPlugin })
  },
}

export default plugin
