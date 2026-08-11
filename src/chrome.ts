export type NavItem = { label: string; href: string; slug: string }
export type SiteChrome = {
  brand: { name: string; shortName: string; logo: string }
  nav: { items: NavItem[]; cta: { label: string; href: string } }
  ticker: { text: string }
}

export function renderHeader(site: SiteChrome, activePage: string): string {
  const navLinks = site.nav.items
    .map((item) => {
      const isActive = item.slug === activePage
      const cls = isActive
        ? 'text-[var(--color-fg)] border-b-2 border-[var(--color-accent)]'
        : 'hover:text-[var(--color-fg)]'
      return `<a href="${item.href}" class="${cls}">${item.label}</a>`
    })
    .join('')

  return `
    <header class="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-[var(--color-fg)]/10 bg-[var(--color-bg)]/95 px-6 py-3 backdrop-blur">
      <a href="/" class="flex items-center gap-2 font-brand text-sm tracking-wide">
        <img src="${site.brand.logo}" alt="" width="32" height="32" />
        ${site.brand.name}
      </a>
      <nav class="hidden flex-1 items-center justify-center gap-5 font-brand text-xs uppercase tracking-wide text-[var(--color-muted)] lg:flex">
        ${navLinks}
      </nav>
      <a href="${site.nav.cta.href}" class="rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-4 py-2 font-brand text-xs font-bold uppercase text-[var(--color-fg)] hover:opacity-90">
        ${site.nav.cta.label}
      </a>
    </header>
  `
}

export function renderFooter(site: SiteChrome): string {
  return `
    <footer class="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-[var(--color-fg)]/10 bg-[var(--color-panel)] px-6 py-3 font-brand text-xs text-[var(--color-muted)]">
      <span class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full bg-[var(--color-accent)]"></span>
        ${site.ticker.text}
      </span>
      <span>${site.brand.shortName}</span>
    </footer>
  `
}
