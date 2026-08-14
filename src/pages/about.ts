import '../style.css'
import site from '../../content/site.json'
import { renderHeader, renderFooter, mountPlayer } from '../chrome'
import { renderPage } from '../renderPage'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${renderHeader(site as any, 'about')}
  <main class="relative isolate overflow-hidden">
    ${renderPage((site.pages as any).about)}
  </main>
  ${renderFooter(site as any)}
`

mountPlayer(site as any)
