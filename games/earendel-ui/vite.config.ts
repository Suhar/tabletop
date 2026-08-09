import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit(), devtoolsJson()],
        build: {
            commonjsOptions: {
                include: [/node_modules/]
            }
        },
        server: {
            port: 5173,
            // Bind every interface, not just loopback. Without this vite listens on [::1]
            // alone, and VS Code's port forwarding connects over IPv4 - so the browser gets
            // "localhost refused to connect" while the server is running perfectly well.
            host: true
        }
    })
)
