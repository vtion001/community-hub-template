import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

function buildMetaPlugin() {
  let sha = 'dev'
  try {
    sha = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    // no git repo yet — fine for local dev
  }
  const stamp = `${sha}-${new Date().toISOString()}`
  return {
    name: 'build-meta',
    transformIndexHtml(html: string) {
      return html.replace(
        '</head>',
        `  <meta name="x-build" content="${stamp}">\n  </head>`
      )
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), buildMetaPlugin()],
  server: {
    fs: { allow: ['..'] },
  },
})
