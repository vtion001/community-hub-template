import '../style.css'
import site from '../../content/site.json'
import { renderHeader, renderFooter, mountPlayer } from '../chrome'
import { renderPage } from '../renderPage'
import { renderAuthSection, mountAuthSection } from '../accountAuth'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${renderHeader(site as any, 'account')}
  <main class="relative isolate overflow-hidden">
    ${renderPage((site.pages as any).account)}
    ${renderAuthSection()}
  </main>
  ${renderFooter(site as any)}
`

mountPlayer(site as any)
mountAuthSection()
