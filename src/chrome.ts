export type NavItem = { label: string; href: string; slug: string }
export type SiteChrome = {
  brand: { name: string; shortName: string; logo: string }
  nav: { items: NavItem[]; cta: { label: string; href: string } }
  ticker: { text: string }
}

function navLinkClass(isActive: boolean): string {
  return isActive
    ? 'text-[var(--color-fg)] border-b-2 border-[var(--color-accent)]'
    : 'hover:text-[var(--color-fg)]'
}

function renderNavLinks(items: NavItem[], activePage: string): string {
  return items
    .map((item) => `<a href="${item.href}" class="${navLinkClass(item.slug === activePage)}">${item.label}</a>`)
    .join('')
}

export function renderHeader(site: SiteChrome, activePage: string): string {
  const navLinks = renderNavLinks(site.nav.items, activePage)

  return `
    <header class="sticky top-0 z-20 border-b border-[var(--color-fg)]/10 bg-[var(--color-bg)]/95 backdrop-blur">
      <div class="relative flex items-center justify-between gap-6 px-6 py-3">
        <a href="/" class="flex items-center gap-2 font-brand text-sm tracking-wide">
          <img src="${site.brand.logo}" alt="" width="32" height="32" />
          ${site.brand.name}
        </a>
        <nav id="desktop-nav" class="hidden flex-1 items-center justify-center gap-5 font-brand text-xs uppercase tracking-wide text-[var(--color-muted)] lg:flex">
          ${navLinks}
        </nav>
        <div class="flex items-center gap-3">
          <details class="lg:hidden">
            <summary class="cursor-pointer list-none font-brand text-xs uppercase tracking-wide text-[var(--color-fg)]">Menu</summary>
            <nav id="mobile-nav" class="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-[var(--color-fg)]/10 bg-[var(--color-bg)] px-6 py-4 font-brand text-xs uppercase tracking-wide text-[var(--color-muted)]">
              ${navLinks}
            </nav>
          </details>
          <a href="${site.nav.cta.href}" class="rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-4 py-2 font-brand text-xs font-bold uppercase text-[var(--color-fg)] hover:opacity-90">
            ${site.nav.cta.label}
          </a>
        </div>
      </div>
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
