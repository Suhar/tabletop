import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit()],
        server: {
            host: '0.0.0.0',
            port: 4195,
            strictPort: true,
            proxy: { '/bots': process.env.TWO_CROWNS_BOT_SERVER ?? 'http://127.0.0.1:4196' }
        }
    })
)
