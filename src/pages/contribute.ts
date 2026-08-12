import '../style.css'
import site from '../../content/site.json'
import { renderHeader, renderFooter, mountPlayer } from '../chrome'
import { renderPage } from '../renderPage'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${renderHeader(site as any, 'contribute')}
  <main class="mx-auto max-w-4xl px-6 py-16">
    ${renderPage((site.pages as any).contribute)}
  </main>
  ${renderFooter(site as any)}
`

mountPlayer(site as any)
