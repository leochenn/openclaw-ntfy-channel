import type { OpenClawPluginApi } from 'openclaw/plugin-sdk'
import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk'
import { ntfyPlugin } from './src/channel/plugin'

const plugin = {
  id: 'openclaw-ntfy-demo',
  name: 'ntfy',
  description: 'ntfy channel demo',
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: ntfyPlugin })
  },
}

export default plugin

