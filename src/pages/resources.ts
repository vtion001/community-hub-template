import '../style.css'
import site from '../../content/site.json'
import { renderHeader, renderFooter } from '../chrome'
import { renderPage } from '../renderPage'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  ${renderHeader(site as any, 'resources')}
  <main class="mx-auto max-w-4xl px-6 py-16">
    ${renderPage((site.pages as any).resources)}
  </main>
  ${renderFooter(site as any)}
`
