import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

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

const root = fileURLToPath(new URL('.', import.meta.url))
const pageSlugs = [
  'events', 'shop', 'blog',
  'gallery', 'about', 'contribute', 'account',
]

export default defineConfig({
  plugins: [tailwindcss(), buildMetaPlugin()],
  server: {
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        ...Object.fromEntries(
          pageSlugs.map((slug) => [slug, path.resolve(root, `${slug}.html`)])
        ),
      },
    },
  },
})
