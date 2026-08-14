// Rebuilds dist-tunnel/ (base=/sig-espresso/) on every source change, for as
// long as this process runs. Uses Vite's JS API directly instead of a CLI
// --base flag, so there's no bash/MSYS path-mangling risk on Windows.
import { build } from 'vite'

await build({
  base: '/sig-espresso/',
  build: {
    outDir: 'dist-tunnel',
    watch: {},
  },
})

console.log('Watching for changes — dist-tunnel/ rebuilds automatically.')
